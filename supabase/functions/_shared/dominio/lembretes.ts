/**
 * Lembretes das funcionalidades 02–06, derivados do estado (sem fila própria):
 * o job do servidor roda `planejar` + `selecionarParaEnvio` a cada minuto; o app usa o
 * mesmo par quando não há servidor. Como tudo deriva do estado atual e do registro do
 * que já saiu (`chave`), mudar a DUM, concluir, dispensar ou cancelar ajusta os
 * lembretes sozinho, sem duplicar; e voltar depois de semanas não gera enxurrada
 * (só sai o que está dentro da tolerância).
 */
import { pautaDaConsulta, proximaConsulta, type ConsultaBase, type PerguntaBase } from "./consultas.ts";
import { lembretesDaSemana } from "./barriga.ts";
import { CATALOGO_MARCOS, DIAS_PUSH_DESCOBERTA, estadoDoMarco, marcoVisivel, perguntaDoMarco, type SituacaoMarco } from "./diario.ts";
import { exameDoCatalogo, nomeDoExame, type ExameBase } from "./exames.ts";
import { horariosDeLembrete, podeAdiar, type DoseBase } from "./medicamentos.ts";
import { prefsCompletas, type Prefs } from "./prefs.ts";
import { dataNoFuso, horaNoFuso, idadeGestacional, inicioDaSemana, instanteLocal, MS_HORA, MS_MIN, somarDiasISO, type DataISO } from "./tempo.ts";
import { textosLembretes as t } from "./textos-lembretes.ts";

export type Categoria = "med" | "exam" | "appt" | "belly" | "diary";
export type Acao = "tomei" | "adiar" | "ja_fiz" | "remarquei";

export interface Lembrete {
  /** Identidade estável: o mesmo lembrete nunca sai duas vezes. */
  chave: string;
  categoria: Categoria;
  /** Tipo para o log e o evento do servidor (exam_reminder_sent {kind}, belly_reminder_sent {variant}). */
  tipo: string;
  /** Entidade (dose, exame, consulta, semana, marco): no máximo 1 por exame por dia (exames RN-05). */
  ref: string;
  em: Date;
  titulo: string;
  corpo: string;
  url: string;
  acoes: Acao[];
  /** Medicamentos RN-13: ignora o horário silencioso e o limite diário. */
  essencial: boolean;
  prioridade: number;
  code?: string;
}

export interface MedicamentoLembrete {
  id: string;
  name: string;
  dose: string | null;
  is_active: boolean;
  reminders_on?: boolean;
  apagado_em?: string | null;
}

export interface EstadoParaLembretes {
  agora: Date;
  tz: string;
  dpp: DataISO | null;
  /** Fim do onboarding (o "cadastro" das specs). */
  criadaEm: string;
  prefs: Prefs | null | undefined;
  medicamentos: MedicamentoLembrete[];
  doses: DoseBase[];
  exames: ExameBase[];
  consultas: ConsultaBase[];
  perguntas: PerguntaBase[];
  semanasComFoto: number[];
  /** Diário da gestante (autora dos marcos). */
  marcos: { respondidos: string[]; estados: { milestone_code: string; skipped_at: string | null; snoozed_until: string | null }[] };
}

const url = (caminho: string, categoria: Categoria, extra: Record<string, string> = {}) => {
  const p = new URLSearchParams({ origem: "lembrete", categoria, ...extra });
  return `${caminho}${caminho.includes("?") ? "&" : "?"}${p.toString()}`;
};

function lembretesDeMedicamentos(e: EstadoParaLembretes, discreto: boolean): Lembrete[] {
  const meds = new Map(e.medicamentos.filter((m) => m.is_active && !m.apagado_em && m.reminders_on !== false).map((m) => [m.id, m]));
  const janela = [e.agora.getTime() - 3 * MS_HORA, e.agora.getTime() + 24 * MS_HORA];
  const saida: Lembrete[] = [];
  for (const d of e.doses) {
    const m = meds.get(d.medication_id);
    if (!m || !d.scheduled_at) continue;
    const t0 = new Date(d.scheduled_at).getTime();
    if (t0 < janela[0]! || t0 > janela[1]!) continue;
    for (const h of horariosDeLembrete(d)) {
      const titulo = discreto ? t.med.discretoTitulo : h.tipo === "principal" ? t.med.principal(m.name) : h.tipo === "reforco" ? t.med.reforco(m.name) : t.med.adiada(m.name);
      saida.push({
        chave: `med:${d.id}:${h.tipo}${h.tipo === "adiada" ? `:${d.snooze_count ?? 0}` : ""}`,
        categoria: "med",
        tipo: `med_dose_${h.tipo}`,
        ref: d.id,
        em: h.em,
        titulo,
        corpo: discreto ? t.med.discretoCorpo : t.med.corpo(m.dose),
        url: url(`/medicamentos?dose=${d.id}`, "med"),
        acoes: podeAdiar(d) ? ["tomei", "adiar"] : ["tomei"],
        essencial: true,
        prioridade: 100,
      });
    }
  }
  return saida;
}

function lembretesDeExames(e: EstadoParaLembretes): Lembrete[] {
  const saida: Lembrete[] = [];
  const as = (data: DataISO, hora: string) => instanteLocal(data, hora, e.tz);
  for (const x of e.exames) {
    if (x.apagado_em) continue;
    const nome = nomeDoExame(x);
    const code = x.catalog_code ?? "custom";
    const base = { categoria: "exam" as const, ref: x.id, essencial: false, code, url: url(`/exames/${x.id}`, "exam", { code }) };
    // RN-03 (só do catálogo; RN-09: personalizado não tem lembrete de janela). A chave não leva a
    // data: mudar a DUM move o horário do que ainda não saiu e nunca repete o que já saiu.
    if (x.status === "to_schedule" && exameDoCatalogo(x.catalog_code) && x.window_start_date && x.window_end_date) {
      saida.push({ ...base, chave: `exam:${x.id}:abre`, tipo: "window_opens", em: as(somarDiasISO(x.window_start_date, -14), "09:00"), titulo: t.exam.abre(), corpo: t.exam.abreCorpo(nome), acoes: [], prioridade: 50 });
      saida.push({ ...base, chave: `exam:${x.id}:fecha7`, tipo: "window_closes_7d", em: as(somarDiasISO(x.window_end_date, -7), "09:00"), titulo: t.exam.fecha7(), corpo: t.exam.fechaCorpo(nome), acoes: [], prioridade: 51 });
      saida.push({ ...base, chave: `exam:${x.id}:fecha2`, tipo: "window_closes_2d", em: as(somarDiasISO(x.window_end_date, -2), "09:00"), titulo: t.exam.fecha2(), corpo: t.exam.fechaCorpo(nome), acoes: [], prioridade: 52 });
    }
    // RN-04
    if (x.status === "scheduled" && x.scheduled_at) {
      const quando = new Date(x.scheduled_at);
      const dia = dataNoFuso(quando, e.tz);
      const hora = x.scheduled_all_day ? null : horaNoFuso(quando, e.tz);
      saida.push({ ...base, chave: `exam:${x.id}:vespera:${x.scheduled_at}`, tipo: "eve", em: as(somarDiasISO(dia, -1), "18:00"), titulo: t.exam.vespera(nome), corpo: t.exam.vesperaCorpo(hora), acoes: [], prioridade: 70 });
      if (!x.scheduled_all_day) {
        saida.push({ ...base, chave: `exam:${x.id}:2h:${x.scheduled_at}`, tipo: "two_hours", em: new Date(quando.getTime() - 2 * MS_HORA), titulo: t.exam.duasHoras(nome), corpo: t.exam.duasHorasCorpo(null), acoes: [], prioridade: 75 });
      }
      saida.push({ ...base, chave: `exam:${x.id}:comofoi:${x.scheduled_at}`, tipo: "how_was_it", em: as(somarDiasISO(dia, 1), "10:00"), titulo: t.exam.comoFoi(nome), corpo: t.exam.comoFoiCorpo, acoes: ["ja_fiz", "remarquei"], prioridade: 60 });
    }
  }
  return saida;
}

function lembretesDeConsultas(e: EstadoParaLembretes): Lembrete[] {
  const saida: Lembrete[] = [];
  const proxima = proximaConsulta(e.consultas, e.agora, e.tz);
  for (const c of e.consultas) {
    if (c.apagado_em || c.status !== "scheduled") continue;
    const quando = new Date(c.starts_at);
    if (quando.getTime() < e.agora.getTime() - 3 * MS_HORA) continue;
    const dia = dataNoFuso(quando, e.tz);
    const pendentes = pautaDaConsulta(c, proxima, e.perguntas).length;
    const base = { categoria: "appt" as const, ref: c.id, essencial: false, acoes: [] as Acao[], url: url(`/consultas/${c.id}`, "appt") };
    saida.push({ ...base, chave: `appt:${c.id}:vespera:${c.starts_at}`, tipo: "eve", em: instanteLocal(somarDiasISO(dia, -1), "18:00", e.tz), titulo: t.appt.vespera(horaNoFuso(quando, e.tz)), corpo: t.appt.vesperaCorpo(pendentes), prioridade: 80 });
    saida.push({ ...base, chave: `appt:${c.id}:2h:${c.starts_at}`, tipo: "two_hours", em: new Date(quando.getTime() - 2 * MS_HORA), titulo: t.appt.duasHoras(), corpo: t.appt.duasHorasCorpo(c.location ?? null), prioridade: 90 });
  }
  return saida;
}

function lembretesDaBarriga(e: EstadoParaLembretes, prefs: Required<Prefs>): Lembrete[] {
  if (!e.dpp) return [];
  const hoje = dataNoFuso(e.agora, e.tz);
  return lembretesDaSemana(e.dpp, hoje, new Set(e.semanasComFoto), { ligados: prefs.belly_reminders, retomadaNaSemana: prefs.belly_resumed_week }).map((l) => ({
    chave: `belly:${l.semana}:${l.tipo}`,
    categoria: "belly" as const,
    tipo: l.tipo === "virada" ? "week_turn" : "nudge",
    ref: `semana-${l.semana}`,
    em: instanteLocal(l.data, l.hora, e.tz),
    titulo: l.tipo === "virada" ? t.belly.virada(l.semana) : t.belly.reforco(l.semana),
    corpo: l.tipo === "virada" ? t.belly.viradaCorpo : t.belly.reforcoCorpo,
    url: url("/barriga", "belly"),
    acoes: [],
    essencial: false,
    prioridade: 40,
  }));
}

/** Diário RN-04: push só nos marcos com `push_on_open`, um por marco. */
function lembretesDoDiario(e: EstadoParaLembretes, prefs: Required<Prefs>): Lembrete[] {
  if (!e.dpp) return [];
  const semana = idadeGestacional(e.dpp, dataNoFuso(e.agora, e.tz)).semana;
  const respondidos = new Set(e.marcos.respondidos);
  const estados = new Map(e.marcos.estados.map((s) => [s.milestone_code, s]));
  const saida: Lembrete[] = [];
  for (const m of CATALOGO_MARCOS) {
    if (!m.push_on_open || !marcoVisivel(m, prefs.faith_mode)) continue;
    const s: SituacaoMarco = { respondido: respondidos.has(m.code), skipped_at: estados.get(m.code)?.skipped_at, snoozed_until: estados.get(m.code)?.snoozed_until };
    if (estadoDoMarco(m, semana, s, e.agora) !== "aberto") continue;
    const dia = m.window_start_week === null ? somarDiasISO(dataNoFuso(new Date(e.criadaEm), e.tz), DIAS_PUSH_DESCOBERTA) : inicioDaSemana(e.dpp, m.window_start_week);
    saida.push({
      chave: `diary:${m.code}`,
      categoria: "diary",
      tipo: "diary_milestone",
      ref: m.code,
      em: instanteLocal(dia, "19:00", e.tz),
      titulo: t.diary.titulo(m.title),
      corpo: perguntaDoMarco(m, prefs.faith_mode),
      url: url(`/diario/escrever?marco=${m.code}`, "diary"),
      acoes: [],
      essencial: false,
      prioridade: 30,
    });
  }
  return saida;
}

/** Todos os lembretes que o estado atual pede (o filtro do "agora" é do `selecionarParaEnvio`). */
export function planejar(e: EstadoParaLembretes): Lembrete[] {
  const prefs = prefsCompletas(e.prefs);
  return [
    ...lembretesDeMedicamentos(e, prefs.notifications_discreet),
    ...lembretesDeExames(e),
    ...lembretesDeConsultas(e),
    ...lembretesDaBarriga(e, prefs),
    ...lembretesDoDiario(e, prefs),
  ];
}

/** Só sai o que venceu há no máximo 30 min: voltar depois de dias não dispara o atrasado. */
export const TOLERANCIA_MS = 30 * MS_MIN;
/** Fundação: no máximo 2 avisos por dia (fora os de medicamento). */
export const LIMITE_DIARIO = 2;

export interface Enviado {
  chave: string;
  categoria: Categoria;
  ref: string;
  enviado_em: string;
  essencial?: boolean;
}

function dentroDoSilencio(hora: string, inicio: string, fim: string): boolean {
  if (inicio === fim) return false;
  return inicio < fim ? hora >= inicio && hora < fim : hora >= inicio || hora < fim;
}

/**
 * Política de envio: vencidos dentro da tolerância, nunca repetidos (chave), suspensão
 * respeitada por todos (RN-13), silêncio e limite diário só para os não essenciais,
 * e no máximo 1 por exame por dia (exames RN-05). Mais prioritários primeiro.
 */
export function selecionarParaEnvio(candidatos: Lembrete[], opcoes: { agora: Date; tz: string; prefs: Prefs | null | undefined; enviados: Enviado[] }): Lembrete[] {
  const prefs = prefsCompletas(opcoes.prefs);
  if (prefs.notifications_suspended) return [];
  const t0 = opcoes.agora.getTime();
  const hoje = dataNoFuso(opcoes.agora, opcoes.tz);
  const jaSaiu = new Set(opcoes.enviados.map((x) => x.chave));
  const deHoje = opcoes.enviados.filter((x) => dataNoFuso(new Date(x.enviado_em), opcoes.tz) === hoje);
  let restantes = LIMITE_DIARIO - deHoje.filter((x) => !x.essencial && x.categoria !== "med").length;
  const examesHoje = new Set(deHoje.filter((x) => x.categoria === "exam").map((x) => x.ref));

  const vencidos = candidatos
    .filter((l) => l.em.getTime() <= t0 && t0 - l.em.getTime() < TOLERANCIA_MS && !jaSaiu.has(l.chave))
    .sort((a, b) => b.prioridade - a.prioridade || a.em.getTime() - b.em.getTime());

  const saida: Lembrete[] = [];
  for (const l of vencidos) {
    if (l.essencial) {
      saida.push(l);
      continue;
    }
    if (dentroDoSilencio(horaNoFuso(l.em, opcoes.tz), prefs.quiet_start, prefs.quiet_end)) continue;
    if (l.categoria === "exam" && examesHoje.has(l.ref)) continue;
    if (restantes <= 0) continue;
    saida.push(l);
    restantes--;
    if (l.categoria === "exam") examesHoje.add(l.ref);
  }
  return saida;
}
