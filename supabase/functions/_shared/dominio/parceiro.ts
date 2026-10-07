/**
 * Funcionalidade 12 · Modo parceiro: convite, "Como ajudar esta semana" e os avisos do parceiro.
 * Puro: o app e o job `enviar-lembretes` usam o mesmo.
 */
import type { ConsultaBase } from "./consultas.ts";
import { nomeDoExame } from "./exames.ts";
import { selecionarParaEnvio, type Enviado, type Lembrete } from "./lembretes.ts";
import { prefsCompletas, type Prefs } from "./prefs.ts";
import { dataNoFuso, horaNoFuso, idadeGestacional, inicioDaSemana, instanteLocal, MS_DIA, somarDiasISO, type DataISO } from "./tempo.ts";
import { textosLembretes as t } from "./textos-lembretes.ts";

// ---------------------------------------------------------------------------
// Convite (RN-01/10/12)
// ---------------------------------------------------------------------------
export const VALIDADE_CONVITE_PARCEIRO_DIAS = 7;
/** Sem I, O, 0 e 1 (ambíguos ao ditar ou digitar). */
export const ALFABETO_CODIGO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** O que ela digita: minúsculas, espaço e hífen valem. */
export function normalizarCodigo(entrada: string): string {
  return entrada.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function codigoValido(codigo: string): boolean {
  return /^[A-HJ-NP-Z2-9]{6}$/.test(normalizarCodigo(codigo));
}

/** Código de 6 a partir de bytes aleatórios (o servidor gera o seu; este é o do modo sem servidor). */
export function gerarCodigo(bytes: Uint8Array): string {
  return [...bytes.slice(0, 6)].map((b) => ALFABETO_CODIGO[b % ALFABETO_CODIGO.length]).join("");
}

export type EstadoConviteParceiro = "valido" | "expirado" | "usado" | "revogado" | "inexistente";

export function estadoConviteParceiro(c: { expires_at: string; accepted_at?: string | null; revoked_at?: string | null } | null | undefined, agora: Date): EstadoConviteParceiro {
  if (!c) return "inexistente";
  if (c.accepted_at) return "usado";
  if (c.revoked_at) return "revogado";
  if (new Date(c.expires_at).getTime() < agora.getTime()) return "expirado";
  return "valido";
}

/** RN-10: o texto que vai junto do link. */
export function mensagemDoConvite(link: string): string {
  return `Entre no Ninho para acompanhar a gravidez comigo: ${link}`;
}

// ---------------------------------------------------------------------------
// "Como ajudar esta semana" (RN-09)
// ---------------------------------------------------------------------------
export interface DicaParceiro {
  week_from: number;
  week_to: number;
  trimester: number;
  feeling_text: string;
  help_tips: string[];
}

export function trimestreDaSemana(semana: number): 1 | 2 | 3 {
  return semana <= 13 ? 1 : semana <= 27 ? 2 : 3;
}

/** RN-09: a da semana; sem ela, a do trimestre; sem nenhuma, null (o card some). */
export function dicaDaSemana(dicas: DicaParceiro[], semana: number): DicaParceiro | null {
  const daSemana = dicas
    .filter((d) => d.week_from <= semana && semana <= d.week_to)
    .sort((a, b) => a.week_to - a.week_from - (b.week_to - b.week_from))[0];
  if (daSemana) return daSemana;
  const tri = trimestreDaSemana(semana);
  return dicas.filter((d) => d.trimester === tri).sort((a, b) => b.week_to - b.week_from - (a.week_to - a.week_from))[0] ?? null;
}

// ---------------------------------------------------------------------------
// Avisos do parceiro (RN-08)
// ---------------------------------------------------------------------------
/** Semanas com aviso de marco (às 09:00). */
export const SEMANAS_MARCO_PARCEIRO = [12, 20, 28, 36, 38, 40] as const;
/** No máximo 3 avisos do parceiro por semana (janela móvel de 7 dias). */
export const LIMITE_SEMANAL_PARCEIRO = 3;

export interface ExameMarcado {
  id: string;
  catalog_code: string | null;
  custom_name: string | null;
  scheduled_at: string | null;
  scheduled_all_day?: boolean;
  /** Quando ela marcou (o aviso sai "no momento"). */
  atualizado_em?: string | null;
}

export interface EstadoParceiro {
  /** Id do parceiro: as chaves são dele (a gestante tem as dela). */
  parceiroId: string;
  agora: Date;
  /** Fuso do aparelho dele. */
  tz: string;
  dpp: DataISO | null;
  prefs: Prefs | null | undefined;
  /** RN-04: sem a permissão `agenda`, nem consultas nem exames. */
  agenda: boolean;
  consultas: ConsultaBase[];
  exames: ExameMarcado[];
}

const link = (caminho: string) => `${caminho}${caminho.includes("?") ? "&" : "?"}origem=lembrete&categoria=partner`;

export function planejarParceiro(e: EstadoParceiro): Lembrete[] {
  const prefs = prefsCompletas(e.prefs);
  const saida: Lembrete[] = [];
  const base = { categoria: "partner" as const, acoes: [], essencial: false };
  if (e.agenda && prefs.partner_appointment_eve) {
    for (const c of e.consultas) {
      if (c.apagado_em || c.status !== "scheduled") continue;
      const quando = new Date(c.starts_at);
      if (quando.getTime() < e.agora.getTime()) continue;
      const dia = dataNoFuso(quando, e.tz);
      saida.push({
        ...base,
        chave: `partner:${e.parceiroId}:appt:${c.id}:${c.starts_at}`,
        tipo: "partner_appointment_eve",
        ref: c.id,
        em: instanteLocal(somarDiasISO(dia, -1), "18:00", e.tz),
        titulo: t.parceiro.vespera(horaNoFuso(quando, e.tz)),
        corpo: t.parceiro.vesperaCorpo(c.location ?? null),
        url: link(`/consultas/${c.id}`),
        prioridade: 80,
      });
    }
  }
  if (e.agenda && prefs.partner_exam_scheduled) {
    for (const x of e.exames) {
      if (!x.scheduled_at || !x.atualizado_em || new Date(x.scheduled_at).getTime() < e.agora.getTime()) continue;
      const quando = new Date(x.scheduled_at);
      const dia = dataNoFuso(quando, e.tz);
      saida.push({
        ...base,
        chave: `partner:${e.parceiroId}:exam:${x.id}:${x.scheduled_at}`,
        tipo: "partner_exam_scheduled",
        ref: x.id,
        em: new Date(x.atualizado_em),
        titulo: t.parceiro.exame(nomeDoExame(x)),
        corpo: t.parceiro.exameCorpo(x.scheduled_all_day ? dia.split("-").reverse().join("/") : `${dia.split("-").reverse().join("/")} às ${horaNoFuso(quando, e.tz)}`),
        url: link("/calendario"),
        prioridade: 70,
      });
    }
  }
  if (e.dpp && prefs.partner_milestones) {
    for (const s of SEMANAS_MARCO_PARCEIRO) {
      saida.push({
        ...base,
        chave: `partner:${e.parceiroId}:marco:${s}`,
        tipo: "partner_milestone",
        ref: `semana-${s}`,
        em: instanteLocal(inicioDaSemana(e.dpp, s), "09:00", e.tz),
        titulo: t.parceiro.marco(s),
        corpo: t.parceiro.marcoCorpo(s),
        url: link("/hoje"),
        prioridade: 60,
      });
    }
  }
  return saida;
}

/** Fundação (silêncio, 2 por dia, suspensão) + RN-08: no máximo 3 por semana. */
export function selecionarParaParceiro(candidatos: Lembrete[], opcoes: { agora: Date; tz: string; prefs: Prefs | null | undefined; enviados: Enviado[] }): Lembrete[] {
  const naSemana = opcoes.enviados.filter((x) => x.categoria === "partner" && opcoes.agora.getTime() - new Date(x.enviado_em).getTime() < 7 * MS_DIA).length;
  const restantes = Math.max(0, LIMITE_SEMANAL_PARCEIRO - naSemana);
  return selecionarParaEnvio(candidatos, opcoes).slice(0, restantes);
}

/** Próximos compromissos da home do parceiro: consultas e exames marcados, em ordem. */
export interface Compromisso {
  tipo: "consulta" | "exame";
  id: string;
  titulo: string;
  quando: string;
  diaInteiro: boolean;
}

export function proximosCompromissos(consultas: ConsultaBase[], exames: ExameMarcado[], agora: Date, tz: string, limite = 3): Compromisso[] {
  const hoje = dataNoFuso(agora, tz);
  const lista: Compromisso[] = [
    ...consultas
      .filter((c) => !c.apagado_em && c.status === "scheduled" && new Date(c.starts_at).getTime() >= agora.getTime() - 2 * 3_600_000)
      .map((c) => ({ tipo: "consulta" as const, id: c.id, titulo: c.provider_name ?? "Consulta", quando: c.starts_at, diaInteiro: false })),
    ...exames
      .filter((x) => x.scheduled_at && (x.scheduled_all_day ? dataNoFuso(new Date(x.scheduled_at), tz) >= hoje : new Date(x.scheduled_at).getTime() >= agora.getTime() - 2 * 3_600_000))
      .map((x) => ({ tipo: "exame" as const, id: x.id, titulo: nomeDoExame(x), quando: x.scheduled_at!, diaInteiro: Boolean(x.scheduled_all_day) })),
  ];
  return lista.sort((a, b) => a.quando.localeCompare(b.quando)).slice(0, limite);
}

/** A semana dele é a dela (DPP da gestante). */
export function semanaDoParceiro(dpp: DataISO | null | undefined, agora: Date, tz: string): number | null {
  if (!dpp) return null;
  return Math.max(0, idadeGestacional(dpp, dataNoFuso(agora, tz)).semana);
}

