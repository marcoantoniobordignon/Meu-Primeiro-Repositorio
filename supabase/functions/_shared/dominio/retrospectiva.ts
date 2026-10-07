/**
 * Funcionalidade 07 · Retrospectiva da gravidez: quais slides existem (com os dados vivos), a frase de cada um,
 * a duração, quando a prévia e a final ficam disponíveis, a validação do nascimento e o push `retro_ready`.
 * Puro: o app (player e exportação) e o job usam o mesmo.
 */
import { idDeterministico } from "./id.ts";
import type { Lembrete } from "./lembretes.ts";
import { diasEntreISO, dumDaDpp, inicioDaSemana, instanteLocal, somarDiasISO, type DataISO } from "./tempo.ts";

export type TipoRetro = "preview" | "final";
export const TIPOS_SLIDE = ["cover", "duration", "discovery", "belly", "ultrasound", "first_kick", "sex_name", "numbers", "quote", "partner", "closing", "bridge"] as const;
export type TipoSlide = (typeof TIPOS_SLIDE)[number];

/** RN-03/05: sempre existem e não podem ser ocultados. */
export const OBRIGATORIOS: readonly TipoSlide[] = ["cover", "duration", "numbers", "closing"];
/** Slides com frase do diário (RN-04): podem trocar de frase. */
export const COM_FRASE: readonly TipoSlide[] = ["discovery", "first_kick", "sex_name", "quote", "partner"];
const MARCO_DO_SLIDE: Partial<Record<TipoSlide, string>> = { discovery: "discovery", first_kick: "first_kick" };

export const SEGUNDOS_POR_SLIDE = 5;
export const SEGUNDOS_TRANSICAO = 0.4;
export const MAX_FRASE = 140;
export const MIN_FOTOS_TIMELAPSE = 3;

export function idDaRetrospectiva(semente: string, kind: TipoRetro): string {
  return idDeterministico(`retro:${semente}:${kind}`);
}

// ---------------------------------------------------------------------------
// Dados de entrada (só o que a retrospectiva usa)
// ---------------------------------------------------------------------------
export interface EntradaDiario {
  id: string;
  body: string | null;
  entry_date: DataISO;
  milestone_code: string | null;
  criado_por?: string | null;
  apagado_em?: string | null;
}
export interface FotoBarriga {
  id: string;
  gest_week: number;
  storage_path: string;
  apagado_em?: string | null;
}
export interface Ultrassom {
  id: string;
  kind: string;
  exam_date: DataISO;
  is_favorite: boolean;
  /** Primeira página (imagem) do documento. */
  storage_path: string | null;
  apagado_em?: string | null;
}
export interface Nascimento {
  nome: string | null;
  data: DataISO;
  /** "HH:MM" ou null. */
  hora: string | null;
  peso_g: number | null;
  comprimento_cm: number | null;
}

/** Texto livre (ela digita) ou uma entrada do diário escolhida. */
export type Escolha = { entrada: string } | { texto: string };
export interface ConfigRetro {
  hidden_slides: string[];
  chosen_entries: Partial<Record<TipoSlide, Escolha>>;
}

export interface DadosRetro {
  kind: TipoRetro;
  /** Quem vê (a gestante): só as entradas dela entram por padrão; as do parceiro, só escolhidas. */
  autora: string;
  dpp: DataISO;
  hoje: DataISO;
  nomeDoBebe: string | null;
  nascimento: Nascimento | null;
  entradas: EntradaDiario[];
  fotos: FotoBarriga[];
  ultrassons: Ultrassom[];
  numeros: { consultas: number; documentos: number; fotos: number; entradas: number };
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------
export interface Frase {
  texto: string;
  data: DataISO | null;
  /** De onde veio (para o editor): entrada do diário ou texto digitado por ela. */
  origem: { entrada: string } | "texto";
}

export type Slide =
  | { tipo: "cover"; nome: string | null; foto: string | null }
  | { tipo: "duration"; semanas: number; dias: number; ate: DataISO }
  | { tipo: "discovery" | "first_kick" | "quote" | "partner"; frase: Frase }
  | { tipo: "sex_name"; sexo: Frase | null; nome: Frase | null }
  | { tipo: "belly"; quadros: { semana: number; caminho: string }[] }
  | { tipo: "ultrasound"; caminho: string; data: DataISO }
  | { tipo: "numbers"; consultas: number; documentos: number; fotos: number; entradas: number }
  | { tipo: "closing"; nome: string | null; nascimento: Nascimento | null }
  | { tipo: "bridge"; nome: string | null };

/** RN-04: a primeira frase (até 140), sem cortar no meio da palavra. */
export function primeiraFrase(texto: string | null | undefined, max = MAX_FRASE): string | null {
  const limpo = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!limpo) return null;
  const fim = limpo.search(/[.!?…](\s|$)/);
  const frase = fim >= 0 ? limpo.slice(0, fim + 1) : limpo;
  if (frase.length <= max) return frase;
  const corte = frase.slice(0, max - 1);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > max * 0.5 ? corte.slice(0, espaco) : corte).replace(/[,;:\s]+$/, "")}…`;
}

const viva = <T extends { apagado_em?: string | null }>(x: T) => !x.apagado_em;

/** RN-04: a frase escolhida (entrada dela, do parceiro ou texto dela) ou, sem escolha, a do marco dela. */
export function fraseDoSlide(tipo: TipoSlide, d: DadosRetro, config: ConfigRetro, marco?: string): Frase | null {
  const escolha = config.chosen_entries[tipo];
  if (escolha && "texto" in escolha) {
    const t = escolha.texto.replace(/\s+/g, " ").trim().slice(0, MAX_FRASE);
    return t ? { texto: t, data: null, origem: "texto" } : null;
  }
  if (escolha && "entrada" in escolha) {
    const e = d.entradas.find((x) => x.id === escolha.entrada && viva(x));
    const t = primeiraFrase(e?.body);
    if (e && t) return { texto: t, data: e.entry_date, origem: { entrada: e.id } };
  }
  // Sem escolha: só o marco escrito por ela. "quote" e "partner" só existem se ela escolher.
  if (!marco) return null;
  const e = d.entradas.filter((x) => viva(x) && x.milestone_code === marco && x.criado_por === d.autora).sort((a, b) => a.entry_date.localeCompare(b.entry_date))[0];
  const t = primeiraFrase(e?.body);
  return e && t ? { texto: t, data: e.entry_date, origem: { entrada: e.id } } : null;
}

/** Semanas e dias da DUM até o parto (final) ou até hoje (prévia). */
export function duracao(dpp: DataISO, ate: DataISO): { semanas: number; dias: number } {
  const total = Math.max(0, diasEntreISO(dumDaDpp(dpp), ate));
  return { semanas: Math.floor(total / 7), dias: total % 7 };
}

/** Todos os slides possíveis com os dados de agora, na ordem, antes de ocultar (RN-03). */
export function slidesPossiveis(d: DadosRetro, config: ConfigRetro): Slide[] {
  const fotos = d.fotos.filter(viva).sort((a, b) => a.gest_week - b.gest_week);
  const ate = d.kind === "final" && d.nascimento ? d.nascimento.data : d.hoje;
  const nome = d.nascimento?.nome?.trim() || d.nomeDoBebe?.trim() || null;
  const us = d.ultrassons.filter((u) => viva(u) && u.is_favorite && u.kind.startsWith("us_") && u.storage_path).sort((a, b) => b.exam_date.localeCompare(a.exam_date))[0];
  const saida: Slide[] = [{ tipo: "cover", nome, foto: fotos.at(-1)?.storage_path ?? null }, { tipo: "duration", ...duracao(d.dpp, ate), ate }];

  const discovery = fraseDoSlide("discovery", d, config, MARCO_DO_SLIDE.discovery);
  if (discovery) saida.push({ tipo: "discovery", frase: discovery });
  if (fotos.length >= MIN_FOTOS_TIMELAPSE) saida.push({ tipo: "belly", quadros: fotos.map((f) => ({ semana: f.gest_week, caminho: f.storage_path })) });
  if (us?.storage_path) saida.push({ tipo: "ultrasound", caminho: us.storage_path, data: us.exam_date });
  const chute = fraseDoSlide("first_kick", d, config, MARCO_DO_SLIDE.first_kick);
  if (chute) saida.push({ tipo: "first_kick", frase: chute });
  // sex_name junta dois marcos; a escolha (se houver) substitui o primeiro que aparecer.
  const escolhaSexo = config.chosen_entries.sex_name;
  const sexo = escolhaSexo ? fraseDoSlide("sex_name", d, config) : fraseDoSlide("sex_name", d, { ...config, chosen_entries: {} }, "sex_known");
  const nomeEscolhido = fraseDoSlide("sex_name", d, { ...config, chosen_entries: {} }, "name_chosen");
  if (sexo || nomeEscolhido) saida.push({ tipo: "sex_name", sexo, nome: escolhaSexo ? null : nomeEscolhido });
  saida.push({ tipo: "numbers", ...d.numeros });
  const quote = fraseDoSlide("quote", d, config);
  if (quote) saida.push({ tipo: "quote", frase: quote });
  const parceiro = fraseDoSlide("partner", d, config);
  if (parceiro) saida.push({ tipo: "partner", frase: parceiro });
  saida.push({ tipo: "closing", nome, nascimento: d.kind === "final" ? d.nascimento : null });
  if (d.kind === "final") saida.push({ tipo: "bridge", nome });
  return saida;
}

export function podeOcultar(tipo: TipoSlide): boolean {
  return !OBRIGATORIOS.includes(tipo);
}

/** RN-05: os slides do player, sem os ocultos (os obrigatórios nunca saem). */
export function slidesVisiveis(d: DadosRetro, config: ConfigRetro): Slide[] {
  const ocultos = new Set(config.hidden_slides);
  return slidesPossiveis(d, config).filter((s) => !podeOcultar(s.tipo) || !ocultos.has(s.tipo));
}

/** O vídeo e os PNGs: os mesmos do player, sem a ponte (é um botão do app, não uma memória). */
export function slidesParaExportar(d: DadosRetro, config: ConfigRetro): Slide[] {
  return slidesVisiveis(d, config).filter((s) => s.tipo !== "bridge");
}

/** Caminhos de todas as fotos que o vídeo precisa (para baixar antes, com progresso: RN-07). */
export function fotosDosSlides(slides: Slide[]): string[] {
  const c = new Set<string>();
  for (const s of slides) {
    if (s.tipo === "cover" && s.foto) c.add(s.foto);
    if (s.tipo === "belly") s.quadros.forEach((q) => c.add(q.caminho));
    if (s.tipo === "ultrasound") c.add(s.caminho);
  }
  return [...c];
}

// ---------------------------------------------------------------------------
// Disponibilidade (RN-01) e nascimento (RN-02/10)
// ---------------------------------------------------------------------------
export const DIAS_PREVIA = 252;

export function previaDisponivel(dpp: DataISO | null | undefined, hoje: DataISO): boolean {
  return Boolean(dpp) && diasEntreISO(dumDaDpp(dpp!), hoje) >= DIAS_PREVIA;
}

export type ErroNascimento = "antes_do_minimo" | "futuro" | "peso" | "comprimento";
export const PESO = { min: 500, max: 7000 } as const;
export const COMPRIMENTO = { min: 20, max: 65 } as const;

/** RN-02: data entre DUM + 140 dias e hoje; peso (500–7000 g) e comprimento (20–65 cm) opcionais. */
export function validarNascimento(e: { data: DataISO; hoje: DataISO; dpp: DataISO | null; peso_g: number | null; comprimento_cm: number | null }): ErroNascimento | null {
  if (e.data > e.hoje) return "futuro";
  if (e.dpp && e.data < somarDiasISO(dumDaDpp(e.dpp), 140)) return "antes_do_minimo";
  if (e.peso_g !== null && (e.peso_g < PESO.min || e.peso_g > PESO.max)) return "peso";
  if (e.comprimento_cm !== null && (e.comprimento_cm < COMPRIMENTO.min || e.comprimento_cm > COMPRIMENTO.max)) return "comprimento";
  return null;
}

/** Peso em gramas ("3.250 g") e comprimento com até uma casa ("49,5 cm"). */
export function formatarPeso(g: number): string {
  return `${Math.round(g).toLocaleString("pt-BR")} g`;
}
export function formatarComprimento(cm: number): string {
  return `${cm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} cm`;
}

// ---------------------------------------------------------------------------
// Push `retro_ready` (RN-09): prévia na semana 38 e a final no dia seguinte ao nascimento, às 10:00
// ---------------------------------------------------------------------------
export function lembretesDaRetrospectiva(e: { dpp: DataISO | null; nascidoEm: DataISO | null; tz: string; criadaEm: string; titulos: { previa: string; final: string; corpo: string } }): Lembrete[] {
  const saida: Lembrete[] = [];
  const base = { categoria: "retro" as const, tipo: "retro_ready", acoes: [], essencial: false, prioridade: 35, corpo: e.titulos.corpo };
  if (e.dpp && !e.nascidoEm) {
    const dia = inicioDaSemana(e.dpp, 38);
    if (new Date(e.criadaEm).getTime() < new Date(`${dia}T00:00:00Z`).getTime()) {
      saida.push({ ...base, chave: "retro:preview", ref: "preview", em: instanteLocal(dia, "10:00", e.tz), titulo: e.titulos.previa, url: "/memorias/retrospectiva?kind=preview&origem=lembrete&categoria=retro" });
    }
  }
  if (e.nascidoEm) {
    saida.push({ ...base, chave: "retro:final", ref: "final", em: instanteLocal(somarDiasISO(e.nascidoEm, 1), "10:00", e.tz), titulo: e.titulos.final, url: "/memorias/retrospectiva?kind=final&origem=lembrete&categoria=retro" });
  }
  return saida;
}
