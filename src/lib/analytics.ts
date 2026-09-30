/**
 * track() tipado. Só nomes de evento definidos nas specs entram aqui.
 * ARQ-05: nunca mandar dado de saúde; só contagens, tipos e flags.
 */

export type Eventos = {
  app_aberto: { modo: "gestacao" | "bebe"; standalone: boolean; online: boolean };
  onb_iniciado: Record<string, never>;
  onb_tela_vista: { n: number };
  onb_valor_visto: { semana: number };
  onb_pulou: { n: number };
  onb_instalacao_mostrada: { sistema: "ios" | "android" | "outro" };
  onb_push_permitido: { permitido: boolean };
  onb_cadastro: { metodo: "google" | "email" | "pulou" };
  onb_concluido: { segundos: number; telas_puladas: number };
  tela_vista: { rota: string; modo: "gestacao" | "bebe" };
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
