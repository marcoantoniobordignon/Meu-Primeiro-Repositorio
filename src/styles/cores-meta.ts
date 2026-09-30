/**
 * Cores que precisam sair como hex literal (meta theme-color, manifest),
 * porque o navegador não resolve var() ali. Espelham --fundo em tokens.css.
 */
export const coresMeta = {
  fundoClaro: "#faf6f4",
  fundoEscuro: "#171513",
} as const;
