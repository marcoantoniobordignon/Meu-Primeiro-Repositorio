import type { Medication, MedicationDose } from "@/lib/dados/colecoes";
import { normalizarTexto } from "@/lib/texto";
import { DIAS_RETROATIVO, LIMITE_ATIVOS_FREE } from "@dominio/medicamentos.ts";
import { dataNoFuso, horaNoFuso, inicioDoDia, MS_MIN, somarDiasISO, type DataISO } from "@dominio/tempo.ts";

/**
 * Funcionalidade 02 · regras do lado do app (adesão, sequência, voz, limite, texto).
 * A agenda e a materialização das doses estão em `@dominio/medicamentos.ts`.
 */

export const DIAS_SEMANA_CURTO = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

/** RN-02: lista curta de nomes comuns, sem dose e sem recomendação (curadoria: decisão em aberto). */
export const NOMES_COMUNS = [
  "Ácido fólico",
  "Sulfato ferroso",
  "Ferro quelato",
  "Polivitamínico gestacional",
  "Vitamina D",
  "Vitamina B12",
  "Ômega 3",
  "Cálcio",
  "Magnésio",
  "Iodo",
  "Levotiroxina",
  "Insulina",
  "Metformina",
  "Ácido acetilsalicílico",
  "Progesterona",
  "Paracetamol",
  "Dimenidrinato",
  "Ondansetrona",
  "Metoclopramida",
  "Omeprazol",
  "Hidróxido de alumínio",
  "Escopolamina",
  "Lactulose",
  "Psyllium",
  "Metildopa",
  "Nifedipino",
  "Enoxaparina",
  "Amoxicilina",
  "Cefalexina",
  "Nitrofurantoína",
] as const;

/** Até 6 nomes da lista que começam com (ou contêm) o que ela digitou, sem acento. */
export function sugestoesDeNome(digitado: string, max = 6): string[] {
  const q = normalizarTexto(digitado);
  if (q.length < 2) return [];
  const comeca = NOMES_COMUNS.filter((n) => normalizarTexto(n).startsWith(q));
  const contem = NOMES_COMUNS.filter((n) => !comeca.includes(n) && normalizarTexto(n).includes(q));
  return [...comeca, ...contem].filter((n) => normalizarTexto(n) !== q).slice(0, max);
}

export function ativos(meds: Medication[]): Medication[] {
  return meds.filter((m) => m.is_active && !m.apagado_em);
}

/** RN-11: free tem até 3 ativos; o 4º abre o paywall. Premium ilimitado. */
export function podeAtivarMais(meds: Medication[], temPlano: boolean): boolean {
  return temPlano || ativos(meds).length < LIMITE_ATIVOS_FREE;
}

function ordenarHoras(horas: string[]): string[] {
  return [...horas].sort();
}

function juntar(itens: string[]): string {
  if (itens.length <= 1) return itens[0] ?? "";
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/** "08:00 e 20:00", "a cada 8 h, desde 08:00", "seg e qua às 08:00", "se necessário". */
export function descreverAgenda(m: Pick<Medication, "schedule_type" | "times" | "interval_hours" | "interval_anchor" | "weekdays">): string {
  switch (m.schedule_type) {
    case "fixed_times":
      return juntar(ordenarHoras(m.times ?? []));
    case "weekdays": {
      const dias = [...(m.weekdays ?? [])].sort((a, b) => a - b).map((d) => DIAS_SEMANA_CURTO[d] ?? "");
      return `${juntar(dias)} às ${juntar(ordenarHoras(m.times ?? []))}`;
    }
    case "interval":
      return `a cada ${m.interval_hours} h, desde ${m.interval_anchor}`;
    case "as_needed":
      return "se necessário";
  }
}

export function dosesVivas(doses: MedicationDose[]): MedicationDose[] {
  return doses.filter((d) => !d.apagado_em);
}

/** Doses do dia (no fuso) em ordem de horário; as "se necessário" entram pela hora em que foram tomadas. */
export function dosesDoDia(doses: MedicationDose[], data: DataISO, tz: string): MedicationDose[] {
  const referencia = (d: MedicationDose) => d.scheduled_at ?? d.taken_at;
  return dosesVivas(doses)
    .filter((d) => {
      const r = referencia(d);
      return r ? dataNoFuso(new Date(r), tz) === data : false;
    })
    .sort((a, b) => new Date(referencia(a)!).getTime() - new Date(referencia(b)!).getTime());
}

export interface Adesao {
  tomadas: number;
  puladas: number;
  semRegistro: number;
  /** 0..1; null sem nenhuma dose contável na janela. */
  taxa: number | null;
}

/**
 * RN-09: tomadas / (tomadas + puladas + sem registro) das doses cujo horário já passou
 * na janela (hoje e os N−1 dias antes). Pendentes ainda não contam; "se necessário" fica fora.
 */
export function adesao(doses: MedicationDose[], agora: Date, tz: string, dias: number): Adesao {
  const inicio = inicioDoDia(somarDiasISO(dataNoFuso(agora, tz), -(dias - 1)), tz).getTime();
  const t = agora.getTime();
  let tomadas = 0;
  let puladas = 0;
  let semRegistro = 0;
  for (const d of dosesVivas(doses)) {
    if (!d.scheduled_at) continue;
    const ms = new Date(d.scheduled_at).getTime();
    if (ms < inicio || ms > t) continue;
    if (d.status === "taken") tomadas++;
    else if (d.status === "skipped") puladas++;
    else if (d.status === "missed") semRegistro++;
  }
  const total = tomadas + puladas + semRegistro;
  return { tomadas, puladas, semRegistro, taxa: total ? tomadas / total : null };
}

/** Barras: adesão de cada um dos últimos N dias (o mais antigo primeiro). */
export function adesaoPorDia(doses: MedicationDose[], agora: Date, tz: string, dias: number): { data: DataISO; taxa: number | null; programadas: number }[] {
  const hoje = dataNoFuso(agora, tz);
  const t = agora.getTime();
  const saida: { data: DataISO; taxa: number | null; programadas: number }[] = [];
  for (let i = dias - 1; i >= 0; i--) {
    const data = somarDiasISO(hoje, -i);
    const doDia = dosesVivas(doses).filter((d) => d.scheduled_at && new Date(d.scheduled_at).getTime() <= t && dataNoFuso(new Date(d.scheduled_at), tz) === data);
    const contaveis = doDia.filter((d) => d.status !== "pending");
    const tomadas = contaveis.filter((d) => d.status === "taken").length;
    saida.push({ data, taxa: contaveis.length ? tomadas / contaveis.length : null, programadas: doDia.length });
  }
  return saida;
}

/**
 * RN-10: dias consecutivos com 100 % das doses programadas tomadas. Hoje só entra
 * quando acaba (a contagem começa ontem). Dia sem dose programada não quebra nem soma.
 */
export function sequencia(doses: MedicationDose[], agora: Date, tz: string): number {
  const porDia = new Map<DataISO, MedicationDose[]>();
  let maisAntigo: DataISO | null = null;
  for (const d of dosesVivas(doses)) {
    if (!d.scheduled_at) continue;
    const data = dataNoFuso(new Date(d.scheduled_at), tz);
    porDia.set(data, [...(porDia.get(data) ?? []), d]);
    if (!maisAntigo || data < maisAntigo) maisAntigo = data;
  }
  if (!maisAntigo) return 0;
  let n = 0;
  for (let dia = somarDiasISO(dataNoFuso(agora, tz), -1); dia >= maisAntigo; dia = somarDiasISO(dia, -1)) {
    const lista = porDia.get(dia);
    if (!lista) continue;
    if (lista.every((d) => d.status === "taken")) n++;
    else break;
  }
  return n;
}

/** RN-08: registro retroativo até 7 dias atrás (pelo dia no fuso). */
export function podeRegistrarRetroativo(d: MedicationDose, agora: Date, tz: string): boolean {
  if (!d.scheduled_at) return false;
  const dia = dataNoFuso(new Date(d.scheduled_at), tz);
  return dia >= somarDiasISO(dataNoFuso(agora, tz), -DIAS_RETROATIVO);
}

/** Dias que a tela Hoje deixa escolher: hoje e os 7 anteriores. */
export function diasNavegaveis(agora: Date, tz: string): DataISO[] {
  const hoje = dataNoFuso(agora, tz);
  return Array.from({ length: DIAS_RETROATIVO + 1 }, (_, i) => somarDiasISO(hoje, -i));
}

export function minutosDeAtraso(d: Pick<MedicationDose, "scheduled_at">, tomadaEm: Date): number {
  if (!d.scheduled_at) return 0;
  return Math.round((tomadaEm.getTime() - new Date(d.scheduled_at).getTime()) / MS_MIN);
}

// ---------------------------------------------------------------------------
// Voz (RN-12)
// ---------------------------------------------------------------------------
const ARTIGOS = new Set(["o", "a", "os", "as", "um", "uma", "meu", "minha", "do", "da", "de", "remedio", "comprimido", "capsula", "gotas"]);
const VERBOS_TOMEI = /\b(tomei|tomo agora|acabei de tomar|ja tomei|tomando)\b/;

/** "tomei o ferro" → "ferro"; null quando a frase não é sobre tomar remédio. */
export function intencaoTomei(transcricao: string): string | null {
  const t = normalizarTexto(transcricao);
  const m = VERBOS_TOMEI.exec(t);
  if (!m) return null;
  const resto = t
    .slice(m.index + m[0].length)
    .split(" ")
    .filter((p) => p && !ARTIGOS.has(p) && !["agora", "ja", "hoje", "certinho"].includes(p));
  return resto.join(" ").trim();
}

function palavras(t: string): string[] {
  return normalizarTexto(t)
    .split(" ")
    .filter((p) => p.length >= 3 && !ARTIGOS.has(p));
}

/**
 * RN-12: compara o nome dito (normalizado) com os ativos. Do mais certo ao mais solto:
 * nome igual; um contém o outro; uma palavra em comum (ou prefixo: "ferro" ↔ "ferroso").
 * Devolve o primeiro nível com acerto, para "vitamina d" não casar com "vitamina b12".
 */
export function casarMedicamento(dito: string, meds: Medication[]): Medication[] {
  const q = normalizarTexto(dito);
  if (!q) return [];
  const lista = ativos(meds).map((m) => ({ m, n: normalizarTexto(m.name) }));
  const iguais = lista.filter((x) => x.n === q);
  if (iguais.length) return iguais.map((x) => x.m);
  const contidos = q.length >= 3 ? lista.filter((x) => x.n.includes(q) || (x.n.length >= 3 && q.includes(x.n))) : [];
  if (contidos.length) return contidos.map((x) => x.m);
  const qs = palavras(q);
  return lista.filter((x) => palavras(x.n).some((w) => qs.some((p) => p === w || w.startsWith(p) || p.startsWith(w)))).map((x) => x.m);
}

/** Dose pendente do medicamento mais próxima de agora, a até 12 h (para a confirmação por voz). */
export function dosePendenteMaisProxima(doses: MedicationDose[], medicationId: string, agora: Date, janelaH = 12): MedicationDose | undefined {
  const t = agora.getTime();
  return dosesVivas(doses)
    .filter((d) => d.medication_id === medicationId && d.status === "pending" && d.scheduled_at && Math.abs(new Date(d.scheduled_at).getTime() - t) <= janelaH * 3_600_000)
    .sort((a, b) => Math.abs(new Date(a.scheduled_at!).getTime() - t) - Math.abs(new Date(b.scheduled_at!).getTime() - t))[0];
}

/** Texto para compartilhar a lista de ativos (sem nada além do que ela anotou). */
export function textoDaLista(meds: Medication[], titulo: string): string {
  const linhas = ativos(meds)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((m) => ["• " + m.name, m.dose, descreverAgenda(m), m.instructions].filter(Boolean).join(" · "));
  return [titulo, ...linhas].join("\n");
}

/** "08:00" no fuso, para a lista do dia. */
export function horaDaDose(d: MedicationDose, tz: string): string {
  const r = d.scheduled_at ?? d.taken_at;
  return r ? horaNoFuso(new Date(r), tz) : "";
}
