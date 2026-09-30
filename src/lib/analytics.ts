/**
 * track() tipado. Só nomes de evento definidos nas specs entram aqui.
 * ARQ-05: nunca mandar dado de saúde; só contagens, tipos e flags.
 */

type Modo = "gestacao" | "bebe";

export type Eventos = {
  // spec 01
  app_aberto: { modo: Modo; standalone: boolean; online: boolean };
  // spec 03
  tela_vista: { rota: string; modo: Modo };
  plus_aberto: { modo: Modo; origem: "tab" | "atalho" };
  tema_alterado: { tema: "auto" | "claro" | "escuro" };
  // spec 04
  onb_iniciado: Record<string, never>;
  onb_tela_vista: { n: number };
  onb_valor_visto: { semana: number };
  onb_pulou: { n: number };
  onb_instalacao_mostrada: { sistema: "ios" | "android" | "outro" };
  onb_push_permitido: { permitido: boolean };
  onb_cadastro: { metodo: "google" | "email" | "pulou" };
  onb_concluido: { segundos: number; telas_puladas: number };
  // spec 05
  home_gestacao_vista: { semana: number; trimestre: number };
  consulta_criada: { tipo: string };
  consulta_realizada: Record<string, never>;
  chutes_sessao: { total: number; minutos: number };
  contracoes_sessao: { n: number; alerta_padrao: boolean };
  // spec 06
  sintoma_registrado: { slug: string; intensidade: number; origem: "chip" | "sheet" | "onboarding" | "voz" };
  sintoma_removido: { slug: string };
  diario_visto: { dias_com_registro: number };
  resumo_copiado: { dias: number; sintomas: number };
  // spec 07
  story_vista: { id: string; categoria: string; semana: number; posicao: number };
  story_concluida: { id: string; cards: number; segundos: number };
  story_guardada: { id: string };
  story_bloqueada_premium: { id: string };
  // spec 08
  voz_iniciada: { modo: Modo; motor: "web_speech" | "gravacao" };
  voz_transcrita: { ms: number; chars: number };
  voz_interpretada: { tipos: string; n: number; confianca: number; ms: number };
  voz_aceita: { n: number };
  voz_corrigida: { tipo: string };
  voz_nao_entendida: { motivo: string };
  voz_sem_permissao: Record<string, never>;
  // spec 09
  home_bebe_vista: { bebes: number; sono_em_andamento: boolean };
  registro_criado: { tipo: string; origem: string; atraso_min: number; autor_papel?: string };
  registro_editado: { tipo: string; campo: string };
  registro_apagado: { tipo: string; desfeito: boolean };
  timer_iniciado: { tipo: string; lado?: string };
  timer_encerrado: { tipo: string; minutos: number };
  dia_visto: { registros: number };
  // spec 10
  previsao_vista: { estado: string; base: string };
  previsao_aviso_ligado: { ligado: boolean };
  previsao_acerto: { diff_min: number };
  // spec 11
  nascimento_registrado: { semanas_gestacao: number; prematuro: boolean; gemeos: boolean; dias_apos_dpp: number };
  nascimento_desfeito: Record<string, never>;
  cortesia_iniciada: Record<string, never>;
  cortesia_encerrada: { converteu: boolean };
  pos_parto_checkin: { dia: number; sinal_alerta: boolean };
  // spec 12
  convite_gerado: { papel: string };
  convite_aberto: { valido: boolean };
  convite_aceito: { papel: string; tinha_conta: boolean };
  membro_removido: { papel: string };
};

type Gtag = (comando: "event", nome: string, params?: Record<string, unknown>) => void;

declare global {
  interface Window {
    gtag?: Gtag;
  }
}

export function track<N extends keyof Eventos>(nome: N, params: Eventos[N]): void {
  if (typeof window === "undefined") return;
  if (window.gtag) {
    window.gtag("event", nome, params);
    return;
  }
  if (process.env.NODE_ENV === "development") {
    console.debug("[track]", nome, params);
  }
}
