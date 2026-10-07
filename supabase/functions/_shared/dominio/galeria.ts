/**
 * Funcionalidade 01 · Galeria de exames e ultrassons: tipos, limites e a validação do que a IA
 * devolve. Puro: o app e a Edge Function `ler-laudo` usam o mesmo.
 */
import { dataNoFuso, diasEntreISO, dumDaDpp, inicioDoDia, somarDiasISO, type DataISO } from "./tempo.ts";

export const TIPOS_DOCUMENTO = ["us_obstetric", "us_nuchal", "us_morpho", "us_other", "blood", "urine", "glucose", "serology", "culture_gbs", "other"] as const;
export type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

/** Limites técnicos do modelo de dados. */
export const MAX_PAGINAS_DOCUMENTO = 20;
export const MAX_BYTES_ARQUIVO = 15 * 1024 * 1024;
/** RN-02: free guarda até 20 páginas somadas (decisão reversível). */
export const LIMITE_PAGINAS_FREE = 20;
/** RN-08: 20 leituras por IA por mês por gestação. */
export const COTA_IA_MES = 20;
/** RN-09: exportar até 50 páginas. */
export const MAX_PAGINAS_EXPORTACAO = 50;
/** RN-09: link de download válido por 24 h. */
export const VALIDADE_EXPORTACAO_S = 24 * 3600;
/** RN-01: data anterior a 90 dias antes da DUM pede confirmação. */
export const DIAS_ANTES_DA_DUM = 90;

export function ehTipo(v: unknown): v is TipoDocumento {
  return typeof v === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(v);
}

/** RN-12: favoritar só em ultrassom. */
export function ehUltrassom(kind: TipoDocumento): boolean {
  return kind.startsWith("us_");
}

/** Exame do catálogo (spec 03) → tipo de documento (para pré-preencher e para a RN-04). */
const TIPO_DO_EXAME: Record<string, TipoDocumento> = {
  us_dating: "us_obstetric",
  nuchal: "us_nuchal",
  morpho: "us_morpho",
  us_growth: "us_obstetric",
  fetal_echo: "us_other",
  blood_1: "blood",
  blood_3: "blood",
  coombs: "blood",
  urine_1: "urine",
  urine_3: "urine",
  ogtt: "glucose",
  gbs: "culture_gbs",
  ctg: "other",
};

export function tipoDoExame(catalogCode: string | null | undefined): TipoDocumento | null {
  return catalogCode ? (TIPO_DO_EXAME[catalogCode] ?? null) : null;
}

export type ErroData = "sem_data" | "futura";

/** RN-01: tipo e data obrigatórios; data não futura; muito antes da DUM pede confirmação (não bloqueia). */
export function validarData(data: DataISO, hoje: DataISO, dpp: DataISO | null | undefined): { erro: ErroData | null; confirmar: boolean } {
  if (!data) return { erro: "sem_data", confirmar: false };
  if (data > hoje) return { erro: "futura", confirmar: false };
  const confirmar = Boolean(dpp && diasEntreISO(data, dumDaDpp(dpp)) > DIAS_ANTES_DA_DUM);
  return { erro: null, confirmar };
}

/**
 * RN-02: as páginas novas cabem no plano? As que já estão guardadas nunca somem, e editar sem
 * página nova (título, data) nunca é barrado, mesmo para quem passou do limite quando era premium.
 */
export function cabeNoPlano(paginasGuardadas: number, novas: number, temPlano: boolean): boolean {
  return temPlano || novas === 0 || paginasGuardadas + novas <= LIMITE_PAGINAS_FREE;
}

// ---------------------------------------------------------------------------
// Leitura por IA (RN-05..08)
// ---------------------------------------------------------------------------
export interface ItemLaudo {
  name: string;
  value: string;
  unit: string | null;
  reference: string | null;
  /** RN-06: só quando o próprio laudo marca (asterisco, negrito, "alterado"). */
  flagged_in_report: boolean;
}

export interface ResumoLaudo {
  exam_name: string | null;
  lab: string | null;
  exam_date: string | null;
  items: ItemLaudo[];
}

/** Esquema JSON pedido ao modelo (saída estruturada). */
export const ESQUEMA_RESUMO = {
  type: "object",
  additionalProperties: false,
  required: ["exam_name", "lab", "exam_date", "items"],
  properties: {
    exam_name: { type: ["string", "null"] },
    lab: { type: ["string", "null"] },
    exam_date: { type: ["string", "null"], description: "YYYY-MM-DD, como está no laudo" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "value", "unit", "reference", "flagged_in_report"],
        properties: {
          name: { type: "string" },
          value: { type: "string" },
          unit: { type: ["string", "null"] },
          reference: { type: ["string", "null"] },
          flagged_in_report: { type: "boolean" },
        },
      },
    },
  },
} as const;

const textoOuNulo = (v: unknown, max: number): string | null | undefined => (v === null ? null : typeof v === "string" ? v.trim().slice(0, max) || null : undefined);

/**
 * RN-07: valida o JSON da IA; qualquer coisa fora do formato devolve null (vira `failed`).
 * Só copia campos conhecidos: o resumo nunca ganha "alto/baixo" calculado (RN-06).
 */
export function validarResumo(bruto: unknown): ResumoLaudo | null {
  if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) return null;
  const o = bruto as Record<string, unknown>;
  const exam_name = textoOuNulo(o.exam_name, 200);
  const lab = textoOuNulo(o.lab, 200);
  const exam_date = textoOuNulo(o.exam_date, 20);
  if (exam_name === undefined || lab === undefined || exam_date === undefined || !Array.isArray(o.items) || o.items.length > 300) return null;
  const items: ItemLaudo[] = [];
  for (const i of o.items) {
    if (!i || typeof i !== "object") return null;
    const r = i as Record<string, unknown>;
    const name = textoOuNulo(r.name, 200);
    const value = textoOuNulo(r.value, 200);
    const unit = textoOuNulo(r.unit, 50);
    const reference = textoOuNulo(r.reference, 300);
    if (!name || !value || unit === undefined || reference === undefined || typeof r.flagged_in_report !== "boolean") return null;
    items.push({ name, value, unit, reference, flagged_in_report: r.flagged_in_report });
  }
  return { exam_name, lab, exam_date, items };
}

/** RN-08: o mês da cota é o mês civil no fuso da gestante; devolve o início deste e do próximo. */
export function janelaDaCota(agora: Date, tz: string): { inicio: Date; renova: Date } {
  const hoje = dataNoFuso(agora, tz);
  const primeiro = `${hoje.slice(0, 7)}-01`;
  const [a, m] = primeiro.split("-").map(Number) as [number, number];
  const proximo = `${m === 12 ? a + 1 : a}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  return { inicio: inicioDoDia(primeiro, tz), renova: inicioDoDia(proximo, tz) };
}

export function cotaRestante(leiturasOkNoMes: number): number {
  return Math.max(0, COTA_IA_MES - leiturasOkNoMes);
}

/** Usado só para documentar a data mínima aceitável no seletor (DUM − 90 dias). */
export function dataMinimaSemConfirmar(dpp: DataISO): DataISO {
  return somarDiasISO(dumDaDpp(dpp), -DIAS_ANTES_DA_DUM);
}

/** Premium no servidor (espelho de `temPlano` do app): assinatura ativa, teste vigente ou cortesia (VIR-02). */
export function familiaTemPlano(f: { plano: string | null; trial_fim?: string | null; cortesia_fim?: string | null }, agora: Date): boolean {
  if (f.plano === "ativo") return true;
  if (f.plano === "trial" && (!f.trial_fim || new Date(f.trial_fim).getTime() > agora.getTime())) return true;
  return Boolean(f.cortesia_fim && new Date(f.cortesia_fim).getTime() > agora.getTime());
}

/** RN-05: o "sim" que o app manda junto vale se é um instante real e não está no futuro (5 min de folga de relógio). */
export function consentimentoValido(givenAt: unknown, agora: Date): givenAt is string {
  if (typeof givenAt !== "string") return false;
  const t = Date.parse(givenAt);
  return Number.isFinite(t) && t <= agora.getTime() + 5 * 60_000;
}

/** Instruções da leitura (RN-06): só transcrever; destacar apenas o que o próprio laudo destaca. */
export const INSTRUCOES_LEITURA = `Você transcreve laudos de exames de pré-natal (fotos ou páginas de PDF) para um app de gestação em português do Brasil.

Regras:
- Transcreva apenas o que está escrito. Não interprete, não diagnostique, não compare com outros exames e não diga se um valor está alto, baixo, normal ou alterado.
- exam_name: o nome do exame como aparece no laudo; lab: o laboratório ou clínica; exam_date: a data de coleta ou realização no formato AAAA-MM-DD. Use null quando não estiver legível ou não existir.
- items: um item por resultado, na ordem do laudo. name e value exatamente como escritos (mantenha vírgula decimal e sinais como "<" ou "Não reagente"); unit e reference como escritos, ou null.
- flagged_in_report é true somente quando o próprio laudo marca aquele valor (asterisco, negrito, seta, "alterado", "fora da referência" ou equivalente). Em qualquer outro caso, false. Nunca calcule isso comparando o valor com a referência.
- Ultrassom: transcreva as medidas e conclusões escritas como itens (por exemplo name "Peso fetal estimado", value "1.250 g").
- Se as imagens não forem um laudo ou estiverem ilegíveis, devolva items vazio e os demais campos null.`;
