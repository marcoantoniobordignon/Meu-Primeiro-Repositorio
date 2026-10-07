/**
 * Funcionalidade 10 · Plano de parto, malas e enxoval: sementes das listas, progresso,
 * lembretes, o card "Qual maternidade?" e o conteúdo do PDF. Puro: app e job usam o mesmo.
 */
import { idDeterministico } from "./id.ts";
import type { Lembrete } from "./lembretes.ts";
import { dataNoFuso, idadeGestacional, inicioDaSemana, instanteLocal, type DataISO } from "./tempo.ts";

export const LISTAS = ["documents", "bag_mother", "bag_baby", "bag_companion", "layette", "baptism"] as const;
export type Lista = (typeof LISTAS)[number];
/** Tela 6 "Malas e enxoval" (o batismo nasce na spec 17 e entra aqui quando existir). */
export const LISTAS_MALAS: Lista[] = ["bag_mother", "bag_baby", "bag_companion", "layette"];
export const ETAPAS = [1, 2, 3, 4, 5] as const;
export type Etapa = (typeof ETAPAS)[number];
export const NOME_ETAPA: Record<Etapa, "onde" | "como" | "quem" | "documentos" | "malas"> = { 1: "onde", 2: "como", 3: "quem", 4: "documentos", 5: "malas" };

/** RN-06: sementes copiadas ao abrir o plano pela primeira vez (revisão editorial em aberto). */
export const SEMENTES: Record<Exclude<Lista, "baptism">, string[]> = {
  documents: [
    "Documento de identidade e CPF",
    "Cartão da gestante",
    "Cartão do SUS",
    "Carteirinha do plano",
    "Exames do pré-natal",
    "Últimos ultrassons",
    "Plano de parto impresso",
    "Certidão de casamento ou união estável (se houver)",
  ],
  bag_mother: ["Camisolas abertas na frente", "Calcinhas descartáveis", "Absorvente pós-parto", "Sutiã de amamentação", "Protetor de seios", "Chinelo", "Meias", "Roupa de saída", "Itens de higiene", "Carregador", "Travesseiro", "Lanche"],
  bag_baby: ["Body", "Macacão", "Meias", "Luvas", "Touca", "Manta", "Fraldas RN", "Lenços umedecidos", "Roupa de saída", "Cadeirinha para o carro (obrigatória)"],
  bag_companion: ["Documento", "Roupa confortável", "Carregador", "Lanche", "Troca de roupa", "Dinheiro"],
  layette: [
    "Body",
    "Macacão",
    "Meias",
    "Mantas",
    "Toalha com capuz",
    "Fraldas",
    "Pomada",
    "Cotonetes",
    "Termômetro",
    "Berço ou moisés",
    "Carrinho",
    "Banheira",
    "Trocador",
    "Cadeirinha",
    "Bolsa maternidade",
    "Babá eletrônica (opcional)",
    "Mamadeira (opcional)",
    "Bomba de leite (opcional)",
    "Kit higiene",
    "Lençóis",
  ],
};

export interface ItemLista {
  id: string;
  list: Lista;
  title: string;
  quantity: number | null;
  note: string | null;
  is_done: boolean;
  is_custom: boolean;
  position: number;
  apagado_em?: string | null;
}

export function idDoPlano(semente: string): string {
  return idDeterministico(`plano-parto:${semente}`);
}

/** Ids determinísticos: dois aparelhos abrindo ao mesmo tempo não duplicam as sementes. */
export function itensSemente(semente: string): ItemLista[] {
  return (Object.keys(SEMENTES) as (keyof typeof SEMENTES)[]).flatMap((list) =>
    SEMENTES[list].map((title, i) => ({ id: idDeterministico(`plano-parto:${semente}:${list}:${i}`), list, title, quantity: null, note: null, is_done: false, is_custom: false, position: i + 1 })),
  );
}

// ---------------------------------------------------------------------------
// Preferências (Como)
// ---------------------------------------------------------------------------
export type Analgesia = "none" | "epidural" | "open" | "undecided";
export type FotosVideo = "allowed" | "no";
export interface PrefsParto {
  analgesia?: Analgesia;
  skin_to_skin?: boolean;
  delayed_cord_clamping?: boolean;
  breastfeeding_first_hour?: boolean;
  companion_in_room?: boolean;
  photos_video?: FotosVideo;
  calm_environment?: boolean;
  free_movement?: boolean;
}
export const PREFS_BOOLEANAS = ["skin_to_skin", "delayed_cord_clamping", "breastfeeding_first_hour", "companion_in_room", "calm_environment", "free_movement"] as const;

export interface PlanoParto {
  id: string;
  maternity_name: string | null;
  maternity_address: string | null;
  maternity_phone: string | null;
  maternity_maps_url: string | null;
  coverage: "sus" | "private" | "unknown" | null;
  insurer_name: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  wished_delivery: "vaginal" | "cesarean" | "open" | "undecided";
  prefs: PrefsParto;
  notes: string | null;
  companion_name: string | null;
  companion_phone: string | null;
  doula_name: string | null;
  doula_phone: string | null;
  emergency_name: string | null;
  emergency_phone: string | null;
  completed_steps: number[];
  apagado_em?: string | null;
}

export function planoVazio(id: string): PlanoParto {
  return {
    id,
    maternity_name: null,
    maternity_address: null,
    maternity_phone: null,
    maternity_maps_url: null,
    coverage: null,
    insurer_name: null,
    doctor_name: null,
    doctor_phone: null,
    wished_delivery: "undecided",
    prefs: {},
    notes: null,
    companion_name: null,
    companion_phone: null,
    doula_name: null,
    doula_phone: null,
    emergency_name: null,
    emergency_phone: null,
    completed_steps: [],
  };
}

// ---------------------------------------------------------------------------
// Progresso (RN-01/06)
// ---------------------------------------------------------------------------
/** RN-01: concluir a etapa não exige campos. Idempotente e ordenado. */
export function concluirEtapa(passos: number[], etapa: Etapa): number[] {
  return [...new Set([...passos, etapa])].filter((p): p is Etapa => (ETAPAS as readonly number[]).includes(p)).sort((a, b) => a - b);
}

export function progressoDoPlano(passos: number[]): { feitas: number; total: 5 } {
  return { feitas: new Set(passos.filter((p) => (ETAPAS as readonly number[]).includes(p))).size, total: 5 };
}

export function itensDaLista<T extends ItemLista>(itens: T[], lista: Lista): T[] {
  return itens.filter((i) => i.list === lista && !i.apagado_em).sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
}

/** RN-06: progresso por lista = feitos / total. */
export function progressoDaLista(itens: ItemLista[], lista: Lista): { feitos: number; total: number } {
  const l = itensDaLista(itens, lista);
  return { feitos: l.filter((i) => i.is_done).length, total: l.length };
}

/** Lista que ainda nem existe (plano nunca aberto) conta como incompleta. */
export function listaCompleta(itens: ItemLista[], listas: Lista[]): boolean {
  return listas.every((l) => {
    const p = progressoDaLista(itens, l);
    return p.total > 0 && p.feitos === p.total;
  });
}

export function proximaPosicao(itens: ItemLista[], lista: Lista): number {
  return Math.max(0, ...itensDaLista(itens, lista).map((i) => i.position)) + 1;
}

/** RN-11: "Onde" vazia = nada da maternidade preenchido. */
export function ondeVazia(p: PlanoParto | null | undefined): boolean {
  return !p || !(p.maternity_name?.trim() || p.maternity_address?.trim() || p.maternity_phone?.trim());
}

/** RN-11: na semana 37 ou depois, sem maternidade, a home pergunta "Qual maternidade?". */
export function mostrarQualMaternidade(semana: number | null, plano: PlanoParto | null | undefined): boolean {
  return semana !== null && semana >= 37 && ondeVazia(plano);
}

/** RN-08: `tel:` com o número cadastrado (só dígitos e o "+" inicial). */
export function linkTel(telefone: string | null | undefined): string | null {
  const limpo = (telefone ?? "").trim().replace(/(?!^\+)[^\d]/g, "");
  return limpo.replace(/\D/g, "").length >= 3 ? `tel:${limpo}` : null;
}

// ---------------------------------------------------------------------------
// Anexos (RN-09)
// ---------------------------------------------------------------------------
export const MAX_ANEXOS_ITEM = 3;
export const LIMITE_ANEXOS_FREE = 10;

export function podeAnexar(noItem: number, total: number, temPlano: boolean): "ok" | "item_cheio" | "limite_free" {
  if (noItem >= MAX_ANEXOS_ITEM) return "item_cheio";
  if (!temPlano && total >= LIMITE_ANEXOS_FREE) return "limite_free";
  return "ok";
}

// ---------------------------------------------------------------------------
// Lembretes (RN-07)
// ---------------------------------------------------------------------------
export const SEMANAS_LEMBRETE_PLANO = [28, 34, 36] as const;
const LISTAS_MALA: Lista[] = ["bag_mother", "bag_baby", "bag_companion"];

export function lembretesDoPlano(e: { dpp: DataISO | null; tz: string; plano: PlanoParto | null | undefined; itens: ItemLista[] }): Lembrete[] {
  if (!e.dpp) return [];
  if (e.plano && progressoDoPlano(e.plano.completed_steps).feitas === 5) return [];
  const saida: Lembrete[] = [];
  const base = (semana: number, titulo: string, corpo: string, url: string): Lembrete => ({
    chave: `birth_plan:${semana}`,
    categoria: "birth_plan",
    tipo: "birth_plan_nudge",
    ref: `semana-${semana}`,
    em: instanteLocal(inicioDaSemana(e.dpp!, semana), "10:00", e.tz),
    titulo,
    corpo,
    url: `${url}?origem=lembrete&categoria=birth_plan&semana=${semana}`,
    acoes: [],
    essencial: false,
    prioridade: 45,
  });
  saida.push(base(28, "Hora de começar o plano de parto", "Maternidade, acompanhante e o que você deseja. Leva poucos minutos.", "/plano-parto"));
  if (!listaCompleta(e.itens, LISTAS_MALA)) saida.push(base(34, "Faltam itens na mala", "Confira o que ainda falta para você, o bebê e quem vai junto.", "/plano-parto/listas"));
  if (!listaCompleta(e.itens, ["documents"])) saida.push(base(36, "Confira os documentos", "Identidade, cartão da gestante e exames: tudo pronto para a maternidade?", "/plano-parto/documentos"));
  return saida;
}

// ---------------------------------------------------------------------------
// PDF (RN-02/05): conteúdo puro; o desenho fica no app (pdf-lib, offline)
// ---------------------------------------------------------------------------
export interface SecaoPdf {
  titulo: string;
  linhas: string[];
}

const ROTULO_PARTO: Record<PlanoParto["wished_delivery"], string> = { vaginal: "Parto normal", cesarean: "Cesárea", open: "Aberta às duas vias", undecided: "Ainda decidindo" };
const ROTULO_ANALGESIA: Record<Analgesia, string> = { none: "Sem analgesia", epidural: "Com analgesia (peridural)", open: "Aberta a analgesia", undecided: "Ainda decidindo sobre analgesia" };
const ROTULO_COBERTURA = { sus: "SUS", private: "Plano de saúde", unknown: "A definir" } as const;
export const ROTULO_PREF: Record<(typeof PREFS_BOOLEANAS)[number], string> = {
  skin_to_skin: "Contato pele a pele logo após o nascimento",
  delayed_cord_clamping: "Clampeamento tardio do cordão",
  breastfeeding_first_hour: "Amamentar na primeira hora",
  companion_in_room: "Acompanhante na sala o tempo todo",
  calm_environment: "Ambiente calmo, luz baixa",
  free_movement: "Liberdade para se movimentar",
};

const junta = (...partes: (string | null | undefined)[]) => partes.map((p) => p?.trim()).filter(Boolean).join(" · ");

/** RN-02: o PDF nunca exige campos; seção vazia some. */
export function secoesDoPdf(p: PlanoParto): SecaoPdf[] {
  const secoes: SecaoPdf[] = [];
  const add = (titulo: string, linhas: (string | null | undefined | false)[]) => {
    const l = linhas.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (l.length) secoes.push({ titulo, linhas: l });
  };
  add("Maternidade", [junta(p.maternity_name), junta(p.maternity_address), p.maternity_phone ? `Telefone: ${p.maternity_phone}` : null, p.coverage ? junta(ROTULO_COBERTURA[p.coverage], p.insurer_name) : p.insurer_name]);
  add("Equipe", [p.doctor_name || p.doctor_phone ? junta(p.doctor_name ? `Médico(a): ${p.doctor_name}` : null, p.doctor_phone) : null, p.doula_name || p.doula_phone ? junta(p.doula_name ? `Doula: ${p.doula_name}` : null, p.doula_phone) : null]);
  add("Acompanhantes", [
    p.companion_name || p.companion_phone ? junta(p.companion_name ? `Acompanhante: ${p.companion_name}` : null, p.companion_phone) : null,
    p.emergency_name || p.emergency_phone ? junta(p.emergency_name ? `Emergência: ${p.emergency_name}` : null, p.emergency_phone) : null,
  ]);
  const prefs = p.prefs ?? {};
  const escolhidas = PREFS_BOOLEANAS.filter((k) => prefs[k]).map((k) => `[x] ${ROTULO_PREF[k]}`);
  add("Preferências (desejos, não garantias)", [
    p.wished_delivery !== "undecided" ? `[x] ${ROTULO_PARTO[p.wished_delivery]}` : null,
    prefs.analgesia && prefs.analgesia !== "undecided" ? `[x] ${ROTULO_ANALGESIA[prefs.analgesia]}` : null,
    ...escolhidas,
    prefs.photos_video ? `[x] ${prefs.photos_video === "allowed" ? "Fotos e vídeo permitidos" : "Sem fotos nem vídeo"}` : null,
  ]);
  add("Observações", [p.notes]);
  return secoes;
}

export function cabecalhoDoPdf(o: { nome?: string | null; dpp: DataISO | null; agora: Date; tz: string; formatar: (d: DataISO) => string }): string[] {
  const semana = o.dpp ? idadeGestacional(o.dpp, dataNoFuso(o.agora, o.tz)).semana : null;
  return [o.nome ? `Nome: ${o.nome}` : null, o.dpp ? `Data provável do parto: ${o.formatar(o.dpp)}` : null, semana !== null && semana >= 0 ? `Semana: ${semana}` : null].filter((x): x is string => Boolean(x));
}
