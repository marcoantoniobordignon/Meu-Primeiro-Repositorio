/**
 * Funcionalidade 14 · Cartas para o bebê: data de abertura (a mesma conta do banco), validações, limites do plano,
 * o que o job abre e quando manda o e-mail anual. Puro: app e job usam o mesmo.
 */
import { somarDiasISO, type DataISO } from "./tempo.ts";

export const REGRAS_ABERTURA = ["first_birthday", "age_5", "age_10", "age_15", "age_18", "custom"] as const;
export type RegraAbertura = (typeof REGRAS_ABERTURA)[number];
export type EstadoCarta = "draft" | "sealed" | "opened";

export interface CartaBase {
  id: string;
  title: string;
  body: string | null;
  audio_path: string | null;
  audio_seconds: number | null;
  photo_path: string | null;
  open_rule: RegraAbertura | null;
  custom_open_on: DataISO | null;
  open_on: DataISO | null;
  status: EstadoCarta;
  delivery_email: string | null;
  apagado_em?: string | null;
}

export const MAX_TITULO = 80;
export const MAX_TEXTO = 5000;
export const MAX_AUDIO_S = 300;
export const CARTAS_FREE = 2;
export const DIAS_MINIMOS_CUSTOM = 180;
export const ANOS_MAXIMOS_CUSTOM = 30;
export const DIAS_DO_LINK = 30;

const ANOS: Record<Exclude<RegraAbertura, "custom">, number> = { first_birthday: 1, age_5: 5, age_10: 10, age_15: 15, age_18: 18 };

/** `data + N anos` como no Postgres: 29/02 vira 28/02 em ano comum. */
export function somarAnos(data: DataISO, anos: number): DataISO {
  const [a, m, d] = data.split("-").map(Number) as [number, number, number];
  const ano = a + anos;
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${ano}-${String(m).padStart(2, "0")}-${String(Math.min(d, ultimo)).padStart(2, "0")}`;
}

/** RN-02: a referência é o nascimento; antes dele, a DPP (o banco recalcula quando o nascimento chega). */
export function referenciaDasCartas(nascimento: DataISO | null | undefined, dpp: DataISO | null | undefined): DataISO | null {
  return nascimento ?? dpp ?? null;
}

export function dataDeAbertura(regra: RegraAbertura | null, referencia: DataISO | null, custom: DataISO | null): DataISO | null {
  if (!regra) return null;
  if (regra === "custom") return custom;
  return referencia ? somarAnos(referencia, ANOS[regra]) : null;
}

/** RN-02: data própria de hoje + 180 dias até hoje + 30 anos. */
export function limitesDaDataPropria(hoje: DataISO): { min: DataISO; max: DataISO } {
  return { min: somarDiasISO(hoje, DIAS_MINIMOS_CUSTOM), max: somarAnos(hoje, ANOS_MAXIMOS_CUSTOM) };
}
export function dataPropriaValida(custom: DataISO | null, hoje: DataISO): boolean {
  if (!custom) return false;
  const { min, max } = limitesDaDataPropria(hoje);
  return custom >= min && custom <= max;
}

export type ErroCarta = "titulo" | "conteudo" | "texto_longo" | "regra" | "data" | "email";

/** RN-01 (salvar): título; o resto pode ficar para depois. */
export function erroAoSalvar(c: Pick<CartaBase, "title" | "body" | "delivery_email">): ErroCarta | null {
  if (!c.title.trim() || c.title.trim().length > MAX_TITULO) return "titulo";
  if ((c.body ?? "").length > MAX_TEXTO) return "texto_longo";
  if (c.delivery_email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.delivery_email.trim())) return "email";
  return null;
}

/** RN-01/02/03 (lacrar): título, texto ou áudio, regra e, se for data própria, uma data válida. */
export function erroAoLacrar(c: Pick<CartaBase, "title" | "body" | "audio_path" | "open_rule" | "custom_open_on" | "delivery_email">, hoje: DataISO): ErroCarta | null {
  const salvar = erroAoSalvar(c);
  if (salvar) return salvar;
  if (!c.body?.trim() && !c.audio_path) return "conteudo";
  if (!c.open_rule) return "regra";
  if (c.open_rule === "custom" && !dataPropriaValida(c.custom_open_on, hoje)) return "data";
  return null;
}

/** RN-07: free tem 2 cartas por autor, só texto; o Completo não tem limite e anexa áudio e foto. */
export function podeCriarCarta(cartasDoAutor: number, temPlano: boolean): boolean {
  return temPlano || cartasDoAutor < CARTAS_FREE;
}

/** RN-10: exporta rascunho e aberta; da lacrada, nunca o conteúdo. */
export function exportavel(c: Pick<CartaBase, "status" | "apagado_em">): boolean {
  return !c.apagado_em && c.status !== "sealed";
}

/** RN-05: o job abre às 06:00 locais as lacradas com `open_on` até hoje (no fuso da autora). */
export const HORA_DE_ABRIR = "06:00";
export function abrirAgora(c: Pick<CartaBase, "status" | "open_on" | "apagado_em">, hojeLocal: DataISO, horaLocal: string): boolean {
  return !c.apagado_em && c.status === "sealed" && c.open_on !== null && c.open_on <= hojeLocal && horaLocal >= HORA_DE_ABRIR;
}

/** RN-11: o e-mail anual sai no aniversário do nascimento (29/02 vira 28/02 em ano comum), a partir das 09:00. */
export function ehAniversario(nascimento: DataISO, hojeLocal: DataISO): boolean {
  const ano = Number(hojeLocal.slice(0, 4));
  const anosDesde = ano - Number(nascimento.slice(0, 4));
  return anosDesde >= 1 && somarAnos(nascimento, anosDesde) === hojeLocal;
}

/** Nome de arquivo seguro para o ZIP. */
export function nomeDeArquivo(titulo: string, extensao: string): string {
  const base = titulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
  return `${base || "carta"}.${extensao}`;
}
