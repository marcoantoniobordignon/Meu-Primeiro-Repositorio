/**
 * Funcionalidade 06 · Diário de grávida: catálogo de marcos e quando cada um vira card.
 * Puro: o app (cards) e o job de lembretes (push dos marcos com `push_on_open`) usam o mesmo.
 * O texto final das perguntas é decisão em aberto (revisão editorial).
 */
import { idDeterministico } from "./id.ts";

export interface Marco {
  code: string;
  title: string;
  prompt_text: string;
  prompt_text_faith: string | null;
  faith_only: boolean;
  /** null = "agora" (aberto desde o início). */
  window_start_week: number | null;
  window_end_week: number | null;
  push_on_open: boolean;
  position: number;
}

/** Sementes de `milestone_catalog` (spec 06, tabela). */
export const CATALOGO_MARCOS: Marco[] = [
  { code: "discovery", title: "Quando descobri", prompt_text: "Como você descobriu a gravidez? Onde estava, o que sentiu, para quem contou primeiro?", prompt_text_faith: "Como você descobriu a gravidez? O que sentiu e o que agradeceu naquele dia?", faith_only: false, window_start_week: null, window_end_week: null, push_on_open: true, position: 1 },
  { code: "told_partner", title: "Contei para quem amo", prompt_text: "Como foi contar para quem você ama? Qual foi a reação?", prompt_text_faith: null, faith_only: false, window_start_week: 5, window_end_week: 14, push_on_open: false, position: 2 },
  { code: "first_ultrasound", title: "Primeiro ultrassom", prompt_text: "Como foi ver o bebê pela primeira vez no ultrassom?", prompt_text_faith: null, faith_only: false, window_start_week: 6, window_end_week: 12, push_on_open: false, position: 3 },
  { code: "heartbeat", title: "Ouvi o coração", prompt_text: "O que passou pela sua cabeça quando ouviu o coração do bebê?", prompt_text_faith: "O que passou pela sua cabeça, e pelo seu coração, quando ouviu o coração do bebê?", faith_only: false, window_start_week: 6, window_end_week: 12, push_on_open: false, position: 4 },
  { code: "belly_shows", title: "A barriga apareceu", prompt_text: "Quando você percebeu a barriga aparecendo? Alguém comentou?", prompt_text_faith: null, faith_only: false, window_start_week: 12, window_end_week: 20, push_on_open: false, position: 5 },
  { code: "sex_known", title: "Descobri o sexo", prompt_text: "Como foi descobrir o sexo do bebê? Era o que você imaginava?", prompt_text_faith: null, faith_only: false, window_start_week: 14, window_end_week: 22, push_on_open: true, position: 6 },
  { code: "first_kick", title: "Primeiro chute", prompt_text: "Como foi sentir o primeiro chute? Onde você estava?", prompt_text_faith: null, faith_only: false, window_start_week: 16, window_end_week: 24, push_on_open: true, position: 7 },
  { code: "name_chosen", title: "Escolhemos o nome", prompt_text: "Como vocês escolheram o nome? Quais outras opções quase ganharam?", prompt_text_faith: null, faith_only: false, window_start_week: 16, window_end_week: 36, push_on_open: false, position: 8 },
  { code: "baby_shower", title: "Chá de bebê", prompt_text: "Como foi o chá de bebê? Quem estava lá e o que ficou na memória?", prompt_text_faith: null, faith_only: false, window_start_week: 28, window_end_week: 36, push_on_open: false, position: 9 },
  { code: "bag_ready", title: "A mala ficou pronta", prompt_text: "O que entrou na mala? O que você fez questão de levar?", prompt_text_faith: null, faith_only: false, window_start_week: 34, window_end_week: 38, push_on_open: false, position: 10 },
  { code: "feelings_before", title: "Como estou me sentindo", prompt_text: "Como você está se sentindo agora, tão perto de conhecer o bebê?", prompt_text_faith: "Como você está se sentindo agora, tão perto de conhecer o bebê? O que você pede para esse momento?", faith_only: false, window_start_week: 36, window_end_week: 41, push_on_open: false, position: 11 },
  { code: "first_prayer", title: "Primeira oração pelo bebê", prompt_text: "Escreva a sua primeira oração pelo bebê.", prompt_text_faith: "Escreva a sua primeira oração pelo bebê. Pode ser curtinha.", faith_only: true, window_start_week: 5, window_end_week: 20, push_on_open: false, position: 12 },
];

/** RN-03: o card fica até 4 semanas depois do fim da janela. */
export const SEMANAS_DE_TOLERANCIA = 4;
/** RN-03: "Mais tarde" some por 3 dias. */
export const ADIAMENTO_MS = 3 * 86_400_000;
/** Critério de aceite: no máximo 3 cards de cada vez. */
export const MAX_CARDS = 3;
/** RN-04: o push do "Quando descobri" sai 2 dias depois do cadastro, se ainda vazio. */
export const DIAS_PUSH_DESCOBERTA = 2;

export function marcoDoCatalogo(code: string | null | undefined): Marco | undefined {
  return code ? CATALOGO_MARCOS.find((m) => m.code === code) : undefined;
}

/** RN-03: com o modo fé ligado, `prompt_text_faith` substitui `prompt_text` quando existe. */
export function perguntaDoMarco(m: Marco, modoFe: boolean): string {
  return modoFe && m.prompt_text_faith ? m.prompt_text_faith : m.prompt_text;
}

export function marcoVisivel(m: Marco, modoFe: boolean): boolean {
  return !m.faith_only || modoFe;
}

export type EstadoMarco = "respondido" | "pulado" | "adiado" | "aberto" | "em_breve" | "passou";

export interface SituacaoMarco {
  respondido: boolean;
  skipped_at?: string | null;
  snoozed_until?: string | null;
}

/** Estado de um marco para a autora, na semana atual. */
export function estadoDoMarco(m: Marco, semanaAtual: number, s: SituacaoMarco, agora: Date): EstadoMarco {
  if (s.respondido) return "respondido";
  if (s.skipped_at) return "pulado";
  if (m.window_start_week !== null && semanaAtual < m.window_start_week) return "em_breve";
  if (m.window_end_week !== null && semanaAtual > m.window_end_week + SEMANAS_DE_TOLERANCIA) return "passou";
  if (s.snoozed_until && new Date(s.snoozed_until).getTime() > agora.getTime()) return "adiado";
  return "aberto";
}

/**
 * RN-03: cards abertos, no máximo 3 (volta depois de meses: os antigos ainda abertos
 * aparecem, sem enxurrada). "Card do próximo marco no topo": "Quando descobri" primeiro,
 * depois a janela aberta mais recentemente (na semana 17, "Primeiro chute" aparece mesmo
 * com marcos antigos em aberto). `faith_only` só com o modo fé.
 */
export function cardsDeMarco(semanaAtual: number, modoFe: boolean, situacao: (code: string) => SituacaoMarco, agora: Date, max = MAX_CARDS): Marco[] {
  const inicio = (m: Marco) => m.window_start_week ?? Number.POSITIVE_INFINITY;
  return CATALOGO_MARCOS.filter((m) => marcoVisivel(m, modoFe) && estadoDoMarco(m, semanaAtual, situacao(m.code), agora) === "aberto")
    .sort((a, b) => inicio(b) - inicio(a) || a.position - b.position)
    .slice(0, max);
}

/** RN-02: um marco por autora; o id da entrada é o mesmo sempre (reabrir edita). */
export function idDaEntradaDoMarco(autor: string, code: string): string {
  return idDeterministico(`diario:${autor}:${code}`);
}

export function idDoEstadoDoMarco(autor: string, code: string): string {
  return idDeterministico(`diario-estado:${autor}:${code}`);
}
