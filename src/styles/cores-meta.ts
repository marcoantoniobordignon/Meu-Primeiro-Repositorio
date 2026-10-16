/**
 * Cores que precisam sair como hex literal (meta theme-color, manifest),
 * porque o navegador não resolve var() ali. Espelham --fundo em tokens.css.
 */
export const coresMeta = {
  fundoClaro: "#f8f3ec",
  fundoEscuro: "#1b1512",
} as const;
