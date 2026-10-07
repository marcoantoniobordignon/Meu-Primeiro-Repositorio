/**
 * Funcionalidade 07 · o desenho da retrospectiva. Um só renderizador para o player e para a exportação: o que ela
 * assiste é, quadro a quadro, o que vira vídeo e PNG. Cada slide é uma coreografia de 5 s, função pura do tempo
 * (`t` em segundos): o mesmo `t` desenha sempre o mesmo quadro, então o vídeo não depende da velocidade do aparelho.
 *
 * Layout em unidades lógicas de 360 × 640 (`u = W / 360`), qualquer resolução 9:16. Cores e fontes vêm dos tokens
 * (`--retro-*`, `--fonte`, `--fonte-serifa`), nunca de hex solto.
 */
import { retroCopy } from "@/copy/retrospectiva";
import { formatarComAno } from "@/lib/dates";
import { formatarComprimento, formatarPeso, SEGUNDOS_POR_SLIDE, SEGUNDOS_TRANSICAO, type Frase, type Slide, type TipoRetro } from "@dominio/retrospectiva.ts";

const T = retroCopy.slides;

export type Imagem = ImageBitmap | HTMLImageElement | HTMLCanvasElement;
export type Recursos = Map<string, Imagem>;

export interface Paleta {
  papel: string;
  papelFundo: string;
  tinta: string;
  tintaSuave: string;
  noite: string;
  noiteFundo: string;
  luz: string;
  luzSuave: string;
  coral: string;
  /** Coral escurecido para texto no papel (AA). */
  coralTinta: string;
  teal: string;
  ouro: string;
}

export interface Estilo {
  cores: Paleta;
  sans: string;
  serifa: string;
  /** "Reduzir movimento": tudo aparece no estado final, sem Ken Burns nem contagens (as fotos ainda trocam). */
  semMovimento: boolean;
  /** Free: "Ninho" no canto (exportação). */
  marca: boolean;
  kind: TipoRetro;
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
function token(nome: string, reserva: string): string {
  if (typeof document === "undefined") return reserva;
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim() || reserva;
}

export function estiloDoDocumento(o: { semMovimento: boolean; marca: boolean; kind: TipoRetro }): Estilo {
  const c = (n: string) => token(`--retro-${n}`, "");
  return {
    cores: {
      papel: c("papel"),
      papelFundo: c("papel-fundo"),
      tinta: c("tinta"),
      tintaSuave: c("tinta-suave"),
      noite: c("noite"),
      noiteFundo: c("noite-fundo"),
      luz: c("luz"),
      luzSuave: c("luz-suave"),
      coral: c("coral"),
      coralTinta: c("coral-tinta"),
      teal: c("teal"),
      ouro: c("ouro"),
    },
    sans: token("--fonte", "system-ui, sans-serif"),
    serifa: token("--fonte-serifa", "Georgia, serif"),
    ...o,
  };
}

/** "#rrggbb" + alfa → rgba() (as cores dos tokens com transparência). */
export function comAlfa(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${Math.max(0, Math.min(1, a))})`;
}

// ---------------------------------------------------------------------------
// Tempo: curvas e trechos
// ---------------------------------------------------------------------------
export const curva = {
  saidaCubica: (x: number) => 1 - (1 - x) ** 3,
  saidaQuinta: (x: number) => 1 - (1 - x) ** 5,
  saidaExpo: (x: number) => (x >= 1 ? 1 : 1 - 2 ** (-10 * x)),
  entradaSaidaCubica: (x: number) => (x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2),
  seno: (x: number) => -(Math.cos(Math.PI * x) - 1) / 2,
};

/** Progresso 0..1 de um trecho que começa em `inicio` e dura `duracao` (com a curva). */
export function trecho(t: number, inicio: number, duracao: number, f: (x: number) => number = curva.saidaCubica): number {
  if (duracao <= 0) return t >= inicio ? 1 : 0;
  return f(Math.max(0, Math.min(1, (t - inicio) / duracao)));
}

const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/** Gerador pseudoaleatório com semente: as partículas são as mesmas no player e no vídeo. */
export function aleatorio(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------
interface Quadro {
  ctx: CanvasRenderingContext2D;
  W: number;
  H: number;
  u: number;
  e: Estilo;
  /** Tempo do slide; com "reduzir movimento", o fim. */
  t: number;
}

function fonte(q: Quadro, tamanho: number, peso: number | string, familia: "sans" | "serifa", italico = false): void {
  q.ctx.font = `${italico ? "italic " : ""}${peso} ${Math.round(tamanho * q.u)}px ${familia === "sans" ? q.e.sans : q.e.serifa}`;
}

function espacamento(q: Quadro, em: number, tamanho: number): void {
  const c = q.ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${Math.round(em * tamanho * q.u * 10) / 10}px`;
}

/** Quebra o texto em linhas que cabem na largura (em unidades). */
export function quebrarLinhas(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = palavra;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Texto que sobe e aparece (a assinatura das entradas). */
function textoQueSobe(q: Quadro, texto: string, x: number, y: number, inicio: number, o: { duracao?: number; subida?: number; cor: string; alinhar?: CanvasTextAlign }): void {
  const p = trecho(q.t, inicio, o.duracao ?? 0.9, curva.saidaQuinta);
  if (p <= 0) return;
  const { ctx, u } = q;
  ctx.save();
  ctx.globalAlpha *= p;
  ctx.fillStyle = o.cor;
  ctx.textAlign = o.alinhar ?? "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(texto, x * u, (y + (o.subida ?? 16) * (1 - p)) * u);
  ctx.restore();
}

/** Linha revelada por uma "cortina" da esquerda para a direita, com leve subida (frases do diário). */
function linhaRevelada(q: Quadro, texto: string, x: number, y: number, inicio: number, cor: string, alturaLinha: number): void {
  const p = trecho(q.t, inicio, 0.85, curva.saidaCubica);
  if (p <= 0) return;
  const { ctx, u } = q;
  const largura = ctx.measureText(texto).width;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x * u - 4 * u, (y - alturaLinha) * u, largura * p + 8 * u, alturaLinha * 1.5 * u);
  ctx.clip();
  ctx.globalAlpha *= Math.min(1, p * 1.6);
  ctx.fillStyle = cor;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(texto, x * u, (y + 6 * (1 - p)) * u);
  ctx.restore();
}

function fundoLiso(q: Quadro, cor: string, brilho: string, cx = 0.5, cy = 0.35): void {
  const { ctx, W, H } = q;
  ctx.fillStyle = cor;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, H * 0.75);
  g.addColorStop(0, brilho);
  g.addColorStop(1, comAlfa(cor, 0));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function tamanhoDe(img: Imagem): { w: number; h: number } {
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight };
  return { w: (img as ImageBitmap).width, h: (img as ImageBitmap).height };
}

/** Foto preenchendo o retângulo (cover), com escala e deslocamento (Ken Burns). */
function fotoCover(q: Quadro, img: Imagem, x: number, y: number, w: number, h: number, escala = 1, dx = 0, dy = 0): void {
  const { ctx } = q;
  const { w: iw, h: ih } = tamanhoDe(img);
  if (!iw || !ih) return;
  const s = Math.max(w / iw, h / ih) * escala;
  const dw = iw * s;
  const dh = ih * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - dw) / 2 + dx, y + (h - dh) / 2 + dy, dw, dh);
  ctx.restore();
}

/** Rótulo em versalete espaçado (o "sobretítulo" de cada slide). */
function rotulo(q: Quadro, texto: string, x: number, y: number, inicio: number, cor: string, alinhar: CanvasTextAlign = "left"): void {
  fonte(q, 11, 600, "sans");
  espacamento(q, 0.22, 11);
  textoQueSobe(q, texto.toLocaleUpperCase("pt-BR"), x, y, inicio, { cor, alinhar, subida: 8, duracao: 0.7 });
  espacamento(q, 0, 11);
}

/** Fio fino que cresce (pontua títulos). */
function fio(q: Quadro, x: number, y: number, largura: number, inicio: number, cor: string, centro = false): void {
  const p = trecho(q.t, inicio, 0.8, curva.saidaQuinta);
  if (p <= 0) return;
  const { ctx, u } = q;
  ctx.save();
  ctx.strokeStyle = cor;
  ctx.lineWidth = 1.5 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  const w = largura * p;
  const x0 = centro ? x - w / 2 : x;
  ctx.moveTo(x0 * u, y * u);
  ctx.lineTo((x0 + w) * u, y * u);
  ctx.stroke();
  ctx.restore();
}

/** Luzes desfocadas subindo devagar (encerramento e capa sem foto). */
function bokeh(q: Quadro, semente: number, quantas: number, cores: string[], intensidade = 1): void {
  const { ctx, W, H, u } = q;
  const r = aleatorio(semente);
  const tempo = q.e.semMovimento ? 0 : q.t;
  for (let i = 0; i < quantas; i++) {
    const x0 = r() * W;
    const y0 = r() * H;
    const raio = (8 + r() * 30) * u;
    const vel = (6 + r() * 14) * u;
    const fase = r() * Math.PI * 2;
    const cor = cores[Math.floor(r() * cores.length)]!;
    const alfa = (0.1 + r() * 0.22) * intensidade;
    const y = ((y0 - vel * tempo) % (H + raio * 2) + H + raio * 2) % (H + raio * 2) - raio;
    const x = x0 + Math.sin(tempo * 0.6 + fase) * 10 * u;
    const g = ctx.createRadialGradient(x, y, 0, x, y, raio);
    g.addColorStop(0, comAlfa(cor, alfa));
    g.addColorStop(1, comAlfa(cor, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, raio, 0, Math.PI * 2);
    ctx.fill();
  }
}

function marcaDagua(q: Quadro, escuro: boolean): void {
  if (!q.e.marca) return;
  const { ctx, W, H, u } = q;
  ctx.save();
  fonte(q, 14, 600, "sans");
  espacamento(q, 0.08, 14);
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = escuro ? q.e.cores.luz : q.e.cores.tinta;
  ctx.textAlign = "right";
  ctx.fillText(T.marca, W - 18 * u, H - 22 * u);
  espacamento(q, 0, 14);
  ctx.restore();
}

/** Número que conta de 0 até o valor (com "reduzir movimento", já no valor). */
function contagem(q: Quadro, valor: number, inicio: number, duracao: number): number {
  return Math.round(valor * trecho(q.t, inicio, duracao, curva.saidaExpo));
}

// ---------------------------------------------------------------------------
// Slides
// ---------------------------------------------------------------------------
function slideCapa(q: Quadro, s: Extract<Slide, { tipo: "cover" }>, rec: Recursos): void {
  const { ctx, W, H, u, e } = q;
  const c = e.cores;
  const foto = s.foto ? rec.get(s.foto) : undefined;
  if (foto) {
    ctx.fillStyle = c.noite;
    ctx.fillRect(0, 0, W, H);
    // Ken Burns: de perto para o enquadramento, subindo um pouco.
    const p = trecho(q.t, 0, SEGUNDOS_POR_SLIDE, curva.seno);
    fotoCover(q, foto, 0, 0, W, H, lerp(1.14, 1.03, p), 0, lerp(10, -6, p) * u);
    const g = ctx.createLinearGradient(0, H * 0.28, 0, H);
    g.addColorStop(0, comAlfa(c.noite, 0));
    g.addColorStop(0.55, comAlfa(c.noite, 0.62));
    g.addColorStop(1, comAlfa(c.noite, 0.94));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    fundoLiso(q, c.noite, comAlfa(c.noiteFundo, 0.95), 0.5, 0.3);
    bokeh(q, 7, 18, [c.coral, c.ouro, c.teal], 0.9);
  }
  rotulo(q, T.rotulo[e.kind], 32, 452, 0.25, c.coral);
  fonte(q, 30, 400, "serifa");
  textoQueSobe(q, T.capa, 32, 498, 0.45, { cor: c.luzSuave });
  const nome = s.nome ?? T.vocesNome;
  let tamanho = 54;
  fonte(q, tamanho, 500, "serifa", true);
  while (ctx.measureText(nome).width > 296 * u && tamanho > 30) fonte(q, (tamanho -= 2), 500, "serifa", true);
  textoQueSobe(q, nome, 32, 498 + tamanho * 1.05, 0.62, { cor: c.luz, subida: 22, duracao: 1.1 });
  fio(q, 34, 498 + tamanho * 1.05 + 26, 56, 1.05, c.coral);
  marcaDagua(q, true);
}

function slideDuracao(q: Quadro, s: Extract<Slide, { tipo: "duration" }>): void {
  const { ctx, W, u, e } = q;
  const c = e.cores;
  fundoLiso(q, c.papel, comAlfa(c.papelFundo, 0.9), 0.5, 0.42);
  rotulo(q, T.duracaoRotulo, 180, 128, 0.15, c.coralTinta, "center");
  // O anel da home (semana 40 = volta inteira), desenhando junto com a contagem.
  const cx = W / 2;
  const cy = 300 * u;
  const raio = 112 * u;
  const fracao = Math.min(1, (s.semanas * 7 + s.dias) / 280);
  const p = trecho(q.t, 0.35, 2.0, curva.entradaSaidaCubica);
  ctx.save();
  ctx.lineWidth = 10 * u;
  ctx.lineCap = "round";
  ctx.strokeStyle = c.papelFundo;
  ctx.beginPath();
  ctx.arc(cx, cy, raio, 0, Math.PI * 2);
  ctx.stroke();
  if (p > 0) {
    const g = ctx.createLinearGradient(cx - raio, cy - raio, cx + raio, cy + raio);
    g.addColorStop(0, c.teal);
    g.addColorStop(1, c.coral);
    ctx.strokeStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, raio, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fracao * p);
    ctx.stroke();
    // Marcador do dia na ponta, como na home.
    const a = -Math.PI / 2 + Math.PI * 2 * fracao * p;
    ctx.fillStyle = c.papel;
    ctx.strokeStyle = c.coral;
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * raio, cy + Math.sin(a) * raio, 8 * u, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  const n = contagem(q, s.semanas, 0.35, 2.0);
  fonte(q, 96, 400, "serifa");
  ctx.save();
  ctx.globalAlpha = trecho(q.t, 0.3, 0.6);
  ctx.fillStyle = c.tinta;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(n), cx, cy + 22 * u);
  ctx.restore();
  fonte(q, 16, 400, "serifa", true);
  textoQueSobe(q, T.semanas(s.semanas), 180, 348, 0.9, { cor: c.tintaSuave, alinhar: "center", subida: 8 });
  fonte(q, 30, 400, "serifa");
  textoQueSobe(q, T.eDias(s.dias), 180, 474, 2.1, { cor: c.tinta, alinhar: "center" });
  fonte(q, 13, 400, "sans");
  textoQueSobe(q, e.kind === "final" ? T.duracaoFinal : T.duracaoPrevia, 180, 504, 2.4, { cor: c.tintaSuave, alinhar: "center", subida: 8 });
  marcaDagua(q, false);
}

/** Tamanho da fonte e linhas da frase: cabe em `maxLinhas` (a fonte diminui até 18). */
function ajustarFrase(q: Quadro, texto: string, maxLinhas: number): { tamanho: number; linhas: string[] } {
  let tamanho = 30;
  let linhas: string[] = [];
  do {
    fonte(q, tamanho, 400, "serifa");
    linhas = quebrarLinhas(q.ctx, texto, 296 * q.u);
    if (linhas.length <= maxLinhas) break;
    tamanho -= 2;
  } while (tamanho >= 18);
  return { tamanho, linhas };
}

/** Altura (em unidades) que o bloco de frase ocupa, do rótulo à data. */
function alturaDoBloco(q: Quadro, f: Frase, maxLinhas: number): number {
  const { tamanho, linhas } = ajustarFrase(q, f.texto, maxLinhas);
  return 56 + tamanho + (linhas.length - 1) * tamanho * 1.32 + (f.data ? 38 : 0);
}

/** Bloco de frase do diário: aspas grandes, linhas reveladas, data. Devolve o y final. */
function blocoDeFrase(q: Quadro, f: Frase, rotuloTexto: string, y0: number, inicio: number, escuro: boolean, maxLinhas = 7): number {
  const { ctx, e } = q;
  const c = e.cores;
  const tinta = escuro ? c.luz : c.tinta;
  const suave = escuro ? c.luzSuave : c.tintaSuave;
  rotulo(q, rotuloTexto, 32, y0, inicio, escuro ? c.coral : c.coralTinta);
  // Aspas decorativas que crescem de leve.
  const pa = trecho(q.t, inicio + 0.1, 1.0, curva.saidaQuinta);
  if (pa > 0) {
    ctx.save();
    ctx.globalAlpha = 0.22 * pa;
    fonte(q, 150 * lerp(0.86, 1, pa), 400, "serifa");
    ctx.fillStyle = c.coral;
    ctx.fillText("“", 22 * q.u, (y0 + 108) * q.u);
    ctx.restore();
  }
  // A frase cabe em até `maxLinhas`: a fonte se ajusta.
  const { tamanho, linhas } = ajustarFrase(q, f.texto, maxLinhas);
  fonte(q, tamanho, 400, "serifa");
  const altura = tamanho * 1.32;
  let y = y0 + 56 + tamanho;
  linhas.forEach((l, i) => linhaRevelada(q, l, 32, y + i * altura, inicio + 0.45 + i * 0.14, tinta, altura));
  y += (linhas.length - 1) * altura;
  if (f.data) {
    fonte(q, 13, 400, "sans");
    textoQueSobe(q, formatarComAno(f.data), 32, y + 38, inicio + 0.6 + linhas.length * 0.14, { cor: suave, subida: 8 });
  }
  return y + 38;
}

function slideFrase(q: Quadro, s: Extract<Slide, { tipo: "discovery" | "first_kick" | "quote" | "partner" }>): void {
  const c = q.e.cores;
  const escuro = s.tipo === "first_kick" || s.tipo === "partner";
  if (escuro) fundoLiso(q, c.noite, comAlfa(c.noiteFundo, 0.85), 0.2, 0.2);
  else fundoLiso(q, c.papel, comAlfa(c.papelFundo, 0.95), 0.85, 0.15);
  const rot = { discovery: T.discovery, first_kick: T.first_kick, quote: T.quote, partner: T.partner }[s.tipo];
  blocoDeFrase(q, s.frase, rot, 196, 0.2, escuro);
  marcaDagua(q, escuro);
}

function slideSexoNome(q: Quadro, s: Extract<Slide, { tipo: "sex_name" }>): void {
  const c = q.e.cores;
  fundoLiso(q, c.papel, comAlfa(c.papelFundo, 0.95), 0.15, 0.85);
  // Os dois blocos juntos, centralizados na altura útil (abaixo da barra do player).
  const max = s.sexo && s.nome ? 4 : 7;
  const espaco = 52;
  const total = (s.sexo ? alturaDoBloco(q, s.sexo, max) : 0) + (s.nome ? alturaDoBloco(q, s.nome, max) : 0) + (s.sexo && s.nome ? espaco : 0);
  let y = Math.max(100, 96 + (600 - 96 - total) / 2);
  if (s.sexo) y = blocoDeFrase(q, s.sexo, T.sexo, y, 0.2, false, max) + espaco;
  if (s.nome) blocoDeFrase(q, s.nome, T.nome, y, s.sexo ? 2.0 : 0.2, false, max);
  marcaDagua(q, false);
}

function slideBarriga(q: Quadro, s: Extract<Slide, { tipo: "belly" }>, rec: Recursos): void {
  const { ctx, W, H, u, e } = q;
  const c = e.cores;
  ctx.fillStyle = c.noite;
  ctx.fillRect(0, 0, W, H);
  const quadros = s.quadros.filter((x) => rec.has(x.caminho));
  const inicio = 0.25;
  const fim = 4.35;
  const n = Math.max(1, quadros.length);
  const passo = (fim - inicio) / n;
  const pos = Math.max(0, Math.min(n - 1, (q.t - inicio) / passo));
  const i = Math.floor(pos);
  const atual = quadros[i];
  // Cruzamento curto entre as fotos (sem movimento: troca seca).
  const mistura = q.e.semMovimento ? 0 : Math.max(0, Math.min(1, (pos - i - (1 - 0.22)) / 0.22));
  const zoom = lerp(1.06, 1.0, trecho(q.t, 0, SEGUNDOS_POR_SLIDE, curva.seno));
  const area = { x: 0, y: 0, w: W, h: H * 0.78 };
  if (atual) fotoCover(q, rec.get(atual.caminho)!, area.x, area.y, area.w, area.h, zoom);
  const prox = quadros[i + 1];
  if (prox && mistura > 0) {
    ctx.save();
    ctx.globalAlpha = mistura;
    fotoCover(q, rec.get(prox.caminho)!, area.x, area.y, area.w, area.h, zoom);
    ctx.restore();
  }
  // Degradê suave até a noite antes da borda da foto (nenhuma linha dura entre foto e texto).
  const g = ctx.createLinearGradient(0, H * 0.4, 0, H * 0.76);
  g.addColorStop(0, comAlfa(c.noite, 0));
  g.addColorStop(0.6, comAlfa(c.noite, 0.7));
  g.addColorStop(1, c.noite);
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.4, W, H * 0.6);
  // Leve escurecido no topo: o selo e a barra do player respiram sobre qualquer foto.
  const topo = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  topo.addColorStop(0, comAlfa(c.noite, 0.45));
  topo.addColorStop(1, comAlfa(c.noite, 0));
  ctx.fillStyle = topo;
  ctx.fillRect(0, 0, W, H * 0.22);
  // Selo "Semana N" acompanhando a foto.
  const semana = (mistura > 0.5 ? prox : atual)?.semana ?? s.quadros[0]!.semana;
  fonte(q, 13, 600, "sans");
  const selo = T.semana(semana);
  const lw = ctx.measureText(selo).width + 22 * u;
  ctx.save();
  ctx.globalAlpha = trecho(q.t, 0.2, 0.5);
  ctx.fillStyle = comAlfa(c.noite, 0.55);
  ctx.beginPath();
  ctx.roundRect(32 * u, 448 * u, lw, 30 * u, 15 * u);
  ctx.fill();
  ctx.fillStyle = c.luz;
  ctx.textBaseline = "middle";
  ctx.fillText(selo, 43 * u, 463 * u);
  ctx.restore();
  // Linha do tempo das semanas com o ponto andando.
  const primeira = s.quadros[0]!.semana;
  const ultima = s.quadros.at(-1)!.semana;
  const pl = trecho(q.t, 0.3, 0.8);
  const y = 548 * u;
  ctx.save();
  ctx.globalAlpha = pl;
  ctx.strokeStyle = comAlfa(c.luz, 0.25);
  ctx.lineWidth = 2 * u;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(32 * u, y);
  ctx.lineTo(328 * u, y);
  ctx.stroke();
  const frac = n > 1 ? Math.min(1, (pos + mistura * 0) / (n - 1)) : 1;
  ctx.strokeStyle = c.coral;
  ctx.beginPath();
  ctx.moveTo(32 * u, y);
  ctx.lineTo((32 + 296 * frac) * u, y);
  ctx.stroke();
  ctx.fillStyle = c.coral;
  ctx.beginPath();
  ctx.arc((32 + 296 * frac) * u, y, 5 * u, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  fonte(q, 30, 400, "serifa");
  textoQueSobe(q, T.barriga, 32, 528, 0.5, { cor: c.luz });
  fonte(q, 13, 400, "sans");
  textoQueSobe(q, T.barrigaSemanas(primeira, ultima), 32, 580, 0.75, { cor: c.luzSuave, subida: 8 });
  marcaDagua(q, true);
}

function slideUltrassom(q: Quadro, s: Extract<Slide, { tipo: "ultrasound" }>, rec: Recursos): void {
  const { ctx, u, e } = q;
  const c = e.cores;
  fundoLiso(q, c.noite, comAlfa(c.teal, 0.16), 0.5, 0.4);
  const img = rec.get(s.caminho);
  const p = trecho(q.t, 0.15, 1.2, curva.saidaQuinta);
  const lado = 296;
  const x = 32;
  const y = 120;
  const escala = lerp(0.94, 1, p);
  ctx.save();
  ctx.globalAlpha = p;
  const cx = (x + lado / 2) * u;
  const cy = (y + lado / 2) * u;
  ctx.translate(cx, cy);
  ctx.scale(escala, escala);
  ctx.translate(-cx, -cy);
  // Brilho suave em volta da imagem.
  ctx.shadowColor = comAlfa(c.teal, 0.45);
  ctx.shadowBlur = 40 * u;
  ctx.fillStyle = c.noite;
  ctx.beginPath();
  ctx.roundRect(x * u, y * u, lado * u, lado * u, 22 * u);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath();
  ctx.roundRect(x * u, y * u, lado * u, lado * u, 22 * u);
  ctx.clip();
  if (img) fotoCover(q, img, x * u, y * u, lado * u, lado * u, lerp(1.08, 1.0, trecho(q.t, 0, SEGUNDOS_POR_SLIDE, curva.seno)));
  ctx.restore();
  rotulo(q, formatarComAno(s.data), 32, 470, 0.8, c.coral);
  fonte(q, 30, 400, "serifa");
  textoQueSobe(q, T.ultrassom, 32, 512, 1.0, { cor: c.luz });
  marcaDagua(q, true);
}

function slideNumeros(q: Quadro, s: Extract<Slide, { tipo: "numbers" }>): void {
  const { ctx, u, e } = q;
  const c = e.cores;
  fundoLiso(q, c.papel, comAlfa(c.papelFundo, 0.9), 0.5, 0.1);
  rotulo(q, T.numeros, 32, 130, 0.15, c.coralTinta);
  fio(q, 32, 146, 40, 0.35, c.coral);
  const itens: [number, string][] = [
    [s.consultas, T.consultas(s.consultas)],
    [s.documentos, T.documentos(s.documentos)],
    [s.fotos, T.fotos(s.fotos)],
    [s.entradas, T.entradas(s.entradas)],
  ];
  itens.forEach(([valor, rot], i) => {
    const col = i % 2;
    const lin = Math.floor(i / 2);
    const x = 32 + col * 152;
    const y = 186 + lin * 176;
    const inicio = 0.4 + i * 0.16;
    const p = trecho(q.t, inicio, 0.9, curva.saidaQuinta);
    if (p <= 0) return;
    ctx.save();
    ctx.globalAlpha = p;
    const dy = 18 * (1 - p);
    ctx.fillStyle = c.papelFundo;
    ctx.beginPath();
    ctx.roundRect(x * u, (y + dy) * u, 144 * u, 160 * u, 18 * u);
    ctx.fill();
    fonte(q, 52, 400, "serifa");
    ctx.fillStyle = c.tinta;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(contagem(q, valor, inicio + 0.1, 1.3)), (x + 16) * u, (y + dy + 78) * u);
    fonte(q, 13, 400, "sans");
    ctx.fillStyle = c.tintaSuave;
    quebrarLinhas(ctx, rot, 112 * u).forEach((l, k) => ctx.fillText(l, (x + 16) * u, (y + dy + 116 + k * 18) * u));
    ctx.restore();
  });
  marcaDagua(q, false);
}

function slideEncerramento(q: Quadro, s: Extract<Slide, { tipo: "closing" }>): void {
  const { ctx, u, e } = q;
  const c = e.cores;
  fundoLiso(q, c.noite, comAlfa(c.noiteFundo, 1), 0.5, 0.45);
  bokeh(q, 31, 26, [c.coral, c.ouro, c.teal, c.ouro]);
  const nome = s.nome ?? T.bebeNome;
  if (s.nascimento) {
    fonte(q, 30, 400, "serifa", true);
    textoQueSobe(q, T.eEntao, 180, 262, 0.3, { cor: c.luzSuave, alinhar: "center" });
    let tamanho = 46;
    fonte(q, tamanho, 500, "serifa");
    while (ctx.measureText(T.chegou(nome)).width > 310 * u && tamanho > 26) fonte(q, (tamanho -= 2), 500, "serifa");
    textoQueSobe(q, T.chegou(nome), 180, 262 + tamanho * 1.2, 0.75, { cor: c.luz, alinhar: "center", subida: 24, duracao: 1.2 });
    fio(q, 180, 262 + tamanho * 1.2 + 28, 64, 1.4, c.coral, true);
    const n = s.nascimento;
    const detalhes = [formatarComAno(n.data), n.hora ? T.hora(n.hora) : null, n.peso_g ? formatarPeso(n.peso_g) : null, n.comprimento_cm ? formatarComprimento(n.comprimento_cm) : null].filter(Boolean) as string[];
    // Pílulas que entram uma a uma, centralizadas em até duas linhas.
    fonte(q, 13, 500, "sans");
    const larg = detalhes.map((d) => ctx.measureText(d).width / u + 26);
    const linhas: number[][] = [[]];
    let soma = 0;
    larg.forEach((w, i) => {
      if (soma + w > 300 && linhas.at(-1)!.length) {
        linhas.push([]);
        soma = 0;
      }
      linhas.at(-1)!.push(i);
      soma += w + 8;
    });
    linhas.forEach((idx, li) => {
      const total = idx.reduce((a, i) => a + larg[i]!, 0) + (idx.length - 1) * 8;
      let x = 180 - total / 2;
      idx.forEach((i) => {
        const p = trecho(q.t, 1.7 + i * 0.18, 0.7, curva.saidaQuinta);
        if (p > 0) {
          const y = 262 + tamanho * 1.2 + 62 + li * 42 + 10 * (1 - p);
          ctx.save();
          ctx.globalAlpha = p;
          ctx.strokeStyle = comAlfa(c.luz, 0.35);
          ctx.lineWidth = 1 * u;
          ctx.beginPath();
          ctx.roundRect(x * u, y * u, larg[i]! * u, 32 * u, 16 * u);
          ctx.stroke();
          ctx.fillStyle = c.luz;
          ctx.textBaseline = "middle";
          ctx.fillText(detalhes[i]!, (x + 13) * u, (y + 16.5) * u);
          ctx.restore();
        }
        x += larg[i]! + 8;
      });
    });
  } else {
    fonte(q, 30, 400, "serifa", true);
    textoQueSobe(q, T.ateLogo, 180, 286, 0.3, { cor: c.luzSuave, alinhar: "center" });
    let tamanho = 50;
    fonte(q, tamanho, 500, "serifa");
    while (ctx.measureText(nome).width > 310 * u && tamanho > 26) fonte(q, (tamanho -= 2), 500, "serifa");
    textoQueSobe(q, nome, 180, 286 + tamanho * 1.15, 0.75, { cor: c.luz, alinhar: "center", subida: 24, duracao: 1.2 });
    fio(q, 180, 286 + tamanho * 1.15 + 28, 64, 1.4, c.coral, true);
    fonte(q, 14, 400, "sans");
    textoQueSobe(q, T.ateLogoApoio, 180, 286 + tamanho * 1.15 + 66, 1.7, { cor: c.luzSuave, alinhar: "center", subida: 8 });
  }
  marcaDagua(q, true);
}

function slidePonte(q: Quadro, s: Extract<Slide, { tipo: "bridge" }>): void {
  const { ctx, W, u, e } = q;
  const c = e.cores;
  fundoLiso(q, c.papel, comAlfa(c.papelFundo, 1), 0.5, 0.38);
  // Um anel novo começando: a outra história.
  const p = trecho(q.t, 0.3, 1.8, curva.entradaSaidaCubica);
  ctx.save();
  ctx.lineWidth = 6 * u;
  ctx.lineCap = "round";
  ctx.strokeStyle = c.papelFundo;
  ctx.beginPath();
  ctx.arc(W / 2, 236 * u, 64 * u, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = c.teal;
  ctx.beginPath();
  ctx.arc(W / 2, 236 * u, 64 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 0.35 * p);
  ctx.stroke();
  // O marcador do dia, como no anel da home: o primeiro dia do bebê.
  if (p > 0) {
    const a = -Math.PI / 2 + Math.PI * 0.35 * p;
    ctx.fillStyle = c.papel;
    ctx.strokeStyle = c.teal;
    ctx.lineWidth = 3 * u;
    ctx.beginPath();
    ctx.arc(W / 2 + Math.cos(a) * 64 * u, 236 * u + Math.sin(a) * 64 * u, 7 * u * trecho(q.t, 0.3, 0.5, curva.saidaQuinta), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
  fonte(q, 30, 400, "serifa");
  textoQueSobe(q, T.ponteTitulo, 180, 372, 0.5, { cor: c.tinta, alinhar: "center" });
  fonte(q, 15, 400, "sans");
  textoQueSobe(q, T.ponte(s.nome ?? T.bebeNome), 180, 404, 0.8, { cor: c.tintaSuave, alinhar: "center", subida: 8 });
}

/** Desenha o slide no tempo `t` (segundos desde o começo dele). */
export function desenharSlide(ctx: CanvasRenderingContext2D, slide: Slide, t: number, rec: Recursos, e: Estilo): void {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const q: Quadro = { ctx, W, H, u: W / 360, e, t: e.semMovimento && slide.tipo !== "belly" ? SEGUNDOS_POR_SLIDE : t };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  switch (slide.tipo) {
    case "cover":
      slideCapa(q, slide, rec);
      break;
    case "duration":
      slideDuracao(q, slide);
      break;
    case "discovery":
    case "first_kick":
    case "quote":
    case "partner":
      slideFrase(q, slide);
      break;
    case "sex_name":
      slideSexoNome(q, slide);
      break;
    case "belly":
      slideBarriga(q, slide, rec);
      break;
    case "ultrasound":
      slideUltrassom(q, slide, rec);
      break;
    case "numbers":
      slideNumeros(q, slide);
      break;
    case "closing":
      slideEncerramento(q, slide);
      break;
    case "bridge":
      slidePonte(q, slide);
      break;
  }
  ctx.restore();
}

/**
 * RN-06: um quadro da sequência no tempo global `tempo`. Cada slide dura 5 s; nos primeiros 0,4 s o novo entra em
 * fade sobre o último quadro do anterior. `apoio` é um canvas do mesmo tamanho para compor a transição.
 */
export function desenharSequencia(ctx: CanvasRenderingContext2D, apoio: HTMLCanvasElement, slides: Slide[], tempo: number, rec: Recursos, e: Estilo): { indice: number; t: number } {
  const indice = Math.max(0, Math.min(slides.length - 1, Math.floor(tempo / SEGUNDOS_POR_SLIDE)));
  const t = Math.min(SEGUNDOS_POR_SLIDE, tempo - indice * SEGUNDOS_POR_SLIDE);
  desenharComEntrada(ctx, apoio, slides[indice - 1] ?? null, slides[indice]!, t, rec, e);
  return { indice, t };
}

/** O slide no tempo `t`, entrando em fade sobre o anterior (ou sobre a noite, no primeiro). */
export function desenharComEntrada(ctx: CanvasRenderingContext2D, apoio: HTMLCanvasElement, anterior: Slide | null, atual: Slide, t: number, rec: Recursos, e: Estilo): void {
  const p = e.semMovimento ? 1 : trecho(t, 0, SEGUNDOS_TRANSICAO, curva.seno);
  if (p >= 1) {
    desenharSlide(ctx, atual, t, rec, e);
    return;
  }
  if (anterior) desenharSlide(ctx, anterior, SEGUNDOS_POR_SLIDE, rec, e);
  else {
    ctx.fillStyle = e.cores.noite;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  const a = apoio.getContext("2d")!;
  desenharSlide(a, atual, t, rec, e);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.drawImage(apoio, 0, 0);
  ctx.restore();
}

/** Texto do slide para leitor de tela (o canvas não é lido). */
export function descricaoDoSlide(s: Slide): string {
  switch (s.tipo) {
    case "cover":
      return `${T.capa} ${s.nome ?? T.vocesNome}`;
    case "duration":
      return `${s.semanas} ${T.semanas(s.semanas)} ${T.eDias(s.dias)}`;
    case "discovery":
    case "first_kick":
    case "quote":
    case "partner":
      return `${{ discovery: T.discovery, first_kick: T.first_kick, quote: T.quote, partner: T.partner }[s.tipo]}: ${s.frase.texto}`;
    case "sex_name":
      return [s.sexo && `${T.sexo}: ${s.sexo.texto}`, s.nome && `${T.nome}: ${s.nome.texto}`].filter(Boolean).join(". ");
    case "belly":
      return `${T.barriga}. ${T.barrigaSemanas(s.quadros[0]!.semana, s.quadros.at(-1)!.semana)}`;
    case "ultrasound":
      return `${T.ultrassom}. ${formatarComAno(s.data)}`;
    case "numbers":
      return `${T.numeros}: ${s.consultas} ${T.consultas(s.consultas)}, ${s.documentos} ${T.documentos(s.documentos)}, ${s.fotos} ${T.fotos(s.fotos)}, ${s.entradas} ${T.entradas(s.entradas)}`;
    case "closing":
      return s.nascimento ? `${T.eEntao} ${T.chegou(s.nome ?? T.bebeNome)}` : `${T.ateLogo} ${s.nome ?? T.bebeNome}`;
    case "bridge":
      return `${T.ponteTitulo}. ${T.ponte(s.nome ?? T.bebeNome)}`;
  }
}
