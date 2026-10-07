import type { UserExam } from "@/lib/dados/colecoes";
import { CATALOGO_EXAMES, nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso, diasEntreISO, instanteLocal, somarDiasISO, type DataISO } from "@dominio/tempo.ts";

/**
 * Funcionalidade 03 · regras do lado do app: seções da lista, marcação e o card da home.
 * Catálogo, janelas e geração ficam em `@dominio/exames.ts`.
 */

export type Secao = "agora" | "proximos" | "marcados" | "feitos" | "anteriores" | "dispensados";
export const ORDEM_SECOES: Secao[] = ["agora", "proximos", "marcados", "feitos", "anteriores", "dispensados"];

/**
 * "Agora" é hora de marcar: janela aberta ou abrindo nos próximos 14 dias (o mesmo
 * prazo do lembrete "a janela vai abrir"). Assim, na semana 9, a translucência nucal
 * (11s0d) já aparece em "Agora" e o morfológico (20s) em "Próximos" (critério de aceite).
 */
export const ANTECEDENCIA_AGORA_DIAS = 14;

/** Seção de cada exame na data (as janelas fechadas saem de "pendente eterno": RN-01 e critério de retorno). */
export function secaoDoExame(e: UserExam, hoje: DataISO): Secao {
  if (e.status === "dismissed") return "dispensados";
  if (e.status === "done") return "feitos";
  if (e.status === "scheduled") return "marcados";
  if (e.window_end_date && e.window_end_date < hoje) return "anteriores";
  if (e.window_start_date && e.window_start_date > somarDiasISO(hoje, ANTECEDENCIA_AGORA_DIAS)) return "proximos";
  return "agora";
}

export function agruparPorSecao(exames: UserExam[], hoje: DataISO): Record<Secao, UserExam[]> {
  const grupos: Record<Secao, UserExam[]> = { agora: [], proximos: [], marcados: [], feitos: [], anteriores: [], dispensados: [] };
  for (const e of exames) if (!e.apagado_em) grupos[secaoDoExame(e, hoje)].push(e);
  const porData = (a: string | null | undefined, b: string | null | undefined) => (a ?? "9999").localeCompare(b ?? "9999");
  grupos.agora.sort((a, b) => porData(a.window_end_date, b.window_end_date) || nomeDoExame(a).localeCompare(nomeDoExame(b)));
  grupos.proximos.sort((a, b) => porData(a.window_start_date, b.window_start_date) || nomeDoExame(a).localeCompare(nomeDoExame(b)));
  grupos.marcados.sort((a, b) => porData(a.scheduled_at, b.scheduled_at));
  grupos.feitos.sort((a, b) => porData(b.done_on, a.done_on));
  grupos.anteriores.sort((a, b) => porData(b.window_end_date, a.window_end_date));
  grupos.dispensados.sort((a, b) => nomeDoExame(a).localeCompare(nomeDoExame(b)));
  return grupos;
}

export interface Marcacao {
  data: DataISO;
  /** "HH:MM" ou vazio (dia todo). */
  hora: string;
}

export type ErroMarcacao = "sem_data" | "passado";

/** RN-06: data obrigatória, hora opcional; passado não é permitido. */
export function validarMarcacao(m: Marcacao, agora: Date, tz: string): ErroMarcacao | null {
  if (!m.data) return "sem_data";
  const hoje = dataNoFuso(agora, tz);
  if (m.data < hoje) return "passado";
  if (m.data === hoje && m.hora && instanteLocal(m.data, m.hora, tz).getTime() < agora.getTime()) return "passado";
  return null;
}

/** RN-06: fora da janela é permitido, com aviso. */
export function foraDaJanela(e: Pick<UserExam, "window_start_date" | "window_end_date">, data: DataISO): boolean {
  if (!data) return false;
  if (e.window_start_date && data < e.window_start_date) return true;
  if (e.window_end_date && data > e.window_end_date) return true;
  return false;
}

/** Instante gravado em `scheduled_at`: com hora, ela; dia todo, meio-dia local (não escorrega de data em fuso nenhum). */
export function instanteDaMarcacao(m: Marcacao, tz: string): { scheduled_at: string; scheduled_all_day: boolean } {
  if (m.hora) return { scheduled_at: instanteLocal(m.data, m.hora, tz).toISOString(), scheduled_all_day: false };
  return { scheduled_at: instanteLocal(m.data, "12:00", tz).toISOString(), scheduled_all_day: true };
}

/** RN-11: marcado cuja data passou há um dia (ou mais) sem ação vira o card "Seu exame foi ontem?". O mais antigo primeiro. */
export function exameParaPerguntar(exames: UserExam[], agora: Date, tz: string): UserExam | undefined {
  const hoje = dataNoFuso(agora, tz);
  return exames
    .filter((e) => !e.apagado_em && e.status === "scheduled" && e.scheduled_at && diasEntreISO(dataNoFuso(new Date(e.scheduled_at), tz), hoje) >= 1)
    .sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))[0];
}

/** RN-09: nome do exame personalizado, 3 a 60 caracteres. */
export function nomePersonalizadoValido(nome: string): boolean {
  const n = nome.trim();
  return n.length >= 3 && n.length <= 60;
}

/** RN-09: janela opcional em semanas (4..42), início antes do fim. */
export function janelaPersonalizadaValida(inicio: number | null, fim: number | null): boolean {
  const ok = (n: number | null) => n === null || (Number.isInteger(n) && n >= 4 && n <= 42);
  if (!ok(inicio) || !ok(fim)) return false;
  return inicio === null || fim === null || inicio <= fim;
}

/** "Outros exames comuns": os do catálogo que ainda não estão na lista dela. */
export function extrasDisponiveis(exames: UserExam[]) {
  const tem = new Set(exames.filter((e) => !e.apagado_em).map((e) => e.catalog_code));
  return CATALOGO_EXAMES.filter((c) => !tem.has(c.code));
}

const fmtDia = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone: "UTC" });

/** "20 de set." (data de calendário, sem escorregar de fuso). */
export function dataCurta(iso: DataISO): string {
  const [a, m, d] = iso.split("-").map(Number);
  return fmtDia.format(new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1)));
}
