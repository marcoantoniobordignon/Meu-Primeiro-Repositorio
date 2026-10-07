/**
 * Funcionalidade 03 · Lembrete para marcar exames: catálogo de referência e janelas.
 * Puro: o app e o job de lembretes usam as mesmas regras.
 *
 * O catálogo precisa de revisão por profissional de saúde antes do lançamento (decisão em aberto).
 */
import { idDeterministico } from "./id.ts";
import { diasEntreISO, dumDaDpp, somarDiasISO, type DataISO } from "./tempo.ts";

export type DocKind = "lab" | "imaging" | "other";

export interface ExameCatalogo {
  code: string;
  name: string;
  short_desc: string;
  window_start_day: number;
  window_end_day: number;
  trimester: 1 | 2 | 3;
  doc_kind: DocKind;
  is_default_on: boolean;
}

/** "6s0d" → 42; o fim inclui o último dia da semana ("10s6d" → 76). */
export function diaDaSemanaGestacional(semanas: number, dias: number): number {
  return semanas * 7 + dias;
}

const d = diaDaSemanaGestacional;

/** Sementes do catálogo (spec 03, tabela). */
export const CATALOGO_EXAMES: ExameCatalogo[] = [
  { code: "us_dating", name: "Ultrassom inicial", short_desc: "Confirma há quanto tempo você está grávida e quantos bebês são. Pode ser pela barriga ou por via vaginal.", window_start_day: d(6, 0), window_end_day: d(10, 6), trimester: 1, doc_kind: "imaging", is_default_on: true },
  { code: "blood_1", name: "Exames de sangue do 1º trimestre", short_desc: "Tipo de sangue, anemia, açúcar no sangue e infecções como sífilis, HIV e hepatites, para cuidar cedo.", window_start_day: d(6, 0), window_end_day: d(13, 6), trimester: 1, doc_kind: "lab", is_default_on: true },
  { code: "urine_1", name: "Urina e urocultura", short_desc: "Procura infecção urinária, que na gravidez pode não dar nenhum sintoma.", window_start_day: d(6, 0), window_end_day: d(13, 6), trimester: 1, doc_kind: "lab", is_default_on: true },
  { code: "nuchal", name: "Ultrassom de translucência nucal", short_desc: "Mede uma área na nuca do bebê. Ajuda a estimar a chance de algumas alterações genéticas.", window_start_day: d(11, 0), window_end_day: d(13, 6), trimester: 1, doc_kind: "imaging", is_default_on: true },
  { code: "morpho", name: "Ultrassom morfológico", short_desc: "Ultrassom detalhado que olha a formação de cada parte do corpo do bebê.", window_start_day: d(20, 0), window_end_day: d(24, 6), trimester: 2, doc_kind: "imaging", is_default_on: true },
  { code: "ogtt", name: "Curva glicêmica (TOTG)", short_desc: "Você toma um líquido doce e colhe sangue algumas vezes. Serve para ver se há diabetes da gestação.", window_start_day: d(24, 0), window_end_day: d(28, 6), trimester: 2, doc_kind: "lab", is_default_on: true },
  { code: "blood_3", name: "Repetição de exames de sangue", short_desc: "Repete parte dos exames do começo para ver como você está na reta final.", window_start_day: d(28, 0), window_end_day: d(32, 6), trimester: 3, doc_kind: "lab", is_default_on: true },
  { code: "urine_3", name: "Urina e urocultura (repetição)", short_desc: "Repete a busca por infecção urinária, que pode aparecer em qualquer fase.", window_start_day: d(28, 0), window_end_day: d(34, 6), trimester: 3, doc_kind: "lab", is_default_on: true },
  { code: "gbs", name: "Cultura para estreptococo B", short_desc: "Coleta com cotonete para ver se há uma bactéria que pode passar para o bebê no parto.", window_start_day: d(35, 0), window_end_day: d(37, 6), trimester: 3, doc_kind: "lab", is_default_on: true },
  { code: "coombs", name: "Coombs indireto", short_desc: "Para quem tem sangue Rh negativo: vê se o corpo está criando anticorpos contra o sangue do bebê.", window_start_day: d(28, 0), window_end_day: d(29, 6), trimester: 3, doc_kind: "lab", is_default_on: false },
  { code: "fetal_echo", name: "Ecocardiograma fetal", short_desc: "Ultrassom focado no coração do bebê, quando o médico vê motivo para olhar mais de perto.", window_start_day: d(24, 0), window_end_day: d(28, 6), trimester: 2, doc_kind: "imaging", is_default_on: false },
  { code: "us_growth", name: "Ultrassom de crescimento", short_desc: "Confere o tamanho, o peso estimado e o líquido ao redor do bebê.", window_start_day: d(32, 0), window_end_day: d(36, 6), trimester: 3, doc_kind: "imaging", is_default_on: false },
  { code: "ctg", name: "Cardiotocografia", short_desc: "Registra os batimentos do bebê e as contrações por uns 20 a 40 minutos.", window_start_day: d(36, 0), window_end_day: d(40, 6), trimester: 3, doc_kind: "other", is_default_on: false },
];

export function exameDoCatalogo(code: string | null | undefined): ExameCatalogo | undefined {
  return code ? CATALOGO_EXAMES.find((e) => e.code === code) : undefined;
}

export type ExamStatus = "to_schedule" | "scheduled" | "done" | "dismissed";

export interface ExameBase {
  id: string;
  catalog_code: string | null;
  custom_name: string | null;
  status: ExamStatus;
  window_start_date: DataISO | null;
  window_end_date: DataISO | null;
  past_window: boolean;
  window_start_week: number | null;
  window_end_week: number | null;
  scheduled_at: string | null;
  scheduled_all_day: boolean;
  done_on: DataISO | null;
  apagado_em?: string | null;
}

export function nomeDoExame(e: Pick<ExameBase, "catalog_code" | "custom_name">): string {
  return exameDoCatalogo(e.catalog_code)?.name ?? e.custom_name ?? "Exame";
}

/** RN-02: janelas = lmp_date + window_*_day. Personalizado: semanas opcionais (fim inclui o dia 6). */
export function janelaDoExame(e: Pick<ExameBase, "catalog_code" | "window_start_week" | "window_end_week">, dpp: DataISO): { inicio: DataISO | null; fim: DataISO | null } {
  const lmp = dumDaDpp(dpp);
  const cat = exameDoCatalogo(e.catalog_code);
  if (cat) return { inicio: somarDiasISO(lmp, cat.window_start_day), fim: somarDiasISO(lmp, cat.window_end_day) };
  if (e.window_start_week == null && e.window_end_week == null) return { inicio: null, fim: null };
  const ini = e.window_start_week ?? e.window_end_week!;
  const fim = e.window_end_week ?? e.window_start_week!;
  return { inicio: somarDiasISO(lmp, d(ini, 0)), fim: somarDiasISO(lmp, d(fim, 6)) };
}

export function idDoExame(semente: string, code: string): string {
  return idDeterministico(`exame:${semente}:${code}`);
}

/**
 * RN-01: ao criar a gestação, um exame por item padrão. Janela que já terminou na
 * data de criação entra com `past_window` (seção "Anteriores", ação "Já fiz").
 */
export function gerarExamesPadrao(dpp: DataISO, criadaEm: DataISO, semente: string): ExameBase[] {
  return CATALOGO_EXAMES.filter((c) => c.is_default_on).map((c) => criarDoCatalogo(c.code, dpp, criadaEm, semente));
}

export function criarDoCatalogo(code: string, dpp: DataISO, hoje: DataISO, semente: string): ExameBase {
  const j = janelaDoExame({ catalog_code: code, window_start_week: null, window_end_week: null }, dpp);
  return {
    id: idDoExame(semente, code),
    catalog_code: code,
    custom_name: null,
    status: "to_schedule",
    window_start_date: j.inicio,
    window_end_date: j.fim,
    past_window: Boolean(j.fim && j.fim < hoje),
    window_start_week: null,
    window_end_week: null,
    scheduled_at: null,
    scheduled_all_day: false,
    done_on: null,
    apagado_em: null,
  };
}

/**
 * RN-02: mudou a DUM, as janelas dos não concluídos se recalculam. Devolve só os que
 * mudam (sem escrita à toa); os lembretes derivam das janelas, então se ajustam sozinhos.
 */
export function recalcularJanelas<E extends ExameBase>(exames: E[], dpp: DataISO, hoje: DataISO): E[] {
  const mudados: E[] = [];
  for (const e of exames) {
    if (e.apagado_em || e.status === "done") continue;
    const j = janelaDoExame(e, dpp);
    const past = Boolean(j.fim && j.fim < hoje);
    if (j.inicio !== e.window_start_date || j.fim !== e.window_end_date) {
      mudados.push({ ...e, window_start_date: j.inicio, window_end_date: j.fim, past_window: past });
    }
  }
  return mudados;
}

const PESO_ESTADO: Record<ExamStatus, number> = { done: 3, scheduled: 2, dismissed: 1, to_schedule: 0 };

/**
 * Dois aparelhos (ou a sessão local promovida) podem gerar o mesmo exame do catálogo com
 * ids diferentes. Fica o mais avançado (feito > marcado > dispensado > a marcar); empate, o menor id.
 * Devolve os ids a apagar.
 */
export function duplicadosDoCatalogo(exames: ExameBase[]): string[] {
  const porCode = new Map<string, ExameBase[]>();
  for (const e of exames) {
    if (e.apagado_em || !e.catalog_code) continue;
    porCode.set(e.catalog_code, [...(porCode.get(e.catalog_code) ?? []), e]);
  }
  const apagar: string[] = [];
  for (const lista of porCode.values()) {
    if (lista.length < 2) continue;
    const ordenados = [...lista].sort((a, b) => PESO_ESTADO[b.status] - PESO_ESTADO[a.status] || a.id.localeCompare(b.id));
    apagar.push(...ordenados.slice(1).map((e) => e.id));
  }
  return apagar;
}

/** Dias até o fim da janela a partir da data marcada (evento exam_scheduled). */
export function diasAteFimDaJanela(e: Pick<ExameBase, "window_end_date">, dataMarcada: DataISO): number | null {
  return e.window_end_date ? diasEntreISO(dataMarcada, e.window_end_date) : null;
}
