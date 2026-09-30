/** Detecção de plataforma para o passo de instalação do PWA (ONB-05). */

export type Sistema = "ios" | "android" | "outro";

export function detectarSistema(ua: string = typeof navigator === "undefined" ? "" : navigator.userAgent): Sistema {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "outro";
}

/** true quando o app abriu instalado na tela inicial. */
export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.("(display-mode: standalone)").matches === true || nav.standalone === true;
}

export function suportaPush(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

export function estaOnline(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}
