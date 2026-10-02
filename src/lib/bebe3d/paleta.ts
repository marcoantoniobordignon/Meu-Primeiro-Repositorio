/**
 * Paleta da cena 3D do útero. O three.js precisa de números, então os hex
 * vivem aqui (fora de components/ e app/, onde o lint barra). A UI em volta
 * da cena usa os tokens de src/styles/tokens.css, como o resto do app.
 *
 * Direção de arte: luz do sol atravessando tecido. Âmbar, rosado, dourado.
 */
export const paleta = {
  /** Luz principal: sol quente do lado de fora da barriga (~2800 K). */
  sol: 0xffd4a6,
  /** Preenchimento frio e fraco por baixo, para dar volume. */
  preenchimento: 0x7a5a74,
  /** Névoa do líquido amniótico. */
  nevoa: 0x8a3a2e,
  /** Fundo (o que fica atrás da parede do útero). */
  fundo: 0x4a1a16,
  /** Parede do útero: escuro no lado oposto ao sol, claro onde a luz atravessa. */
  uteroEscuro: 0x4e1b17,
  uteroClaro: 0xf08a5a,
  uteroVeia: 0xb83c3c,
  /** Pele do bebê. */
  pele: 0xf2c6b2,
  peleSss: 0xff5a3c,
  /** Placenta e cordão. */
  placenta: 0xa84340,
  placentaBrilho: 0xff8f7a,
  cordao: 0xdfc6cc,
  cordaoVaso: 0xb44a5a,
  /** Partículas em suspensão. */
  particula: 0xffd9a8,
  /** Disco de luz (janela de sol na parede) que gera os god rays. */
  janelaSol: 0xffd6a0,
} as const;
