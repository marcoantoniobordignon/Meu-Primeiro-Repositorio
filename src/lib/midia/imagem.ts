/**
 * Processamento de foto no aparelho (fundação RN-F10, funcionalidade 05 RN-04):
 * maior lado até 1600 px, JPEG 0,85, orientação aplicada e EXIF removido.
 * Redesenhar num canvas e exportar de novo descarta todos os metadados (inclusive a
 * localização): o arquivo que sobe nunca carrega GPS.
 */
export const LADO_MAXIMO = 1600;
export const QUALIDADE_JPEG = 0.85;

export function dimensoesAlvo(largura: number, altura: number, max = LADO_MAXIMO): { largura: number; altura: number } {
  const maior = Math.max(largura, altura);
  if (maior <= max) return { largura: Math.round(largura), altura: Math.round(altura) };
  const f = max / maior;
  return { largura: Math.round(largura * f), altura: Math.round(altura * f) };
}

/** Recorte central numa proporção (3:4 da câmera da barriga). */
export function recorteCentral(largura: number, altura: number, proporcao: number): { x: number; y: number; largura: number; altura: number } {
  if (largura / altura > proporcao) {
    const l = Math.round(altura * proporcao);
    return { x: Math.round((largura - l) / 2), y: 0, largura: l, altura };
  }
  const a = Math.round(largura / proporcao);
  return { x: 0, y: Math.round((altura - a) / 2), largura, altura: a };
}

/**
 * true se o JPEG tem um segmento APP1 "Exif" (onde moram data, aparelho e GPS).
 * Percorre os marcadores até o início da imagem (SOS).
 */
export function jpegTemExif(bytes: Uint8Array): boolean {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return false;
  let i = 2;
  while (i + 4 <= bytes.length) {
    if (bytes[i] !== 0xff) return false;
    const marcador = bytes[i + 1]!;
    if (marcador === 0xda || marcador === 0xd9) return false; // SOS / EOI
    const tamanho = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marcador === 0xe1 && i + 10 <= bytes.length) {
      const id = String.fromCharCode(...bytes.slice(i + 4, i + 8));
      if (id === "Exif") return true;
    }
    i += 2 + tamanho;
  }
  return false;
}

export interface FotoProcessada {
  blob: Blob;
  largura: number;
  altura: number;
}

type Fonte = ImageBitmap | HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;

function tamanhoDaFonte(f: Fonte): { largura: number; altura: number } {
  if (typeof HTMLVideoElement !== "undefined" && f instanceof HTMLVideoElement) return { largura: f.videoWidth, altura: f.videoHeight };
  if (typeof HTMLImageElement !== "undefined" && f instanceof HTMLImageElement) return { largura: f.naturalWidth, altura: f.naturalHeight };
  return { largura: f.width, altura: f.height };
}

/** Desenha a fonte (recortada, se pedido) num canvas no tamanho alvo e exporta JPEG sem metadados. */
export async function exportarJpeg(fonte: Fonte, opcoes: { proporcao?: number; espelhar?: boolean } = {}): Promise<FotoProcessada> {
  const { largura, altura } = tamanhoDaFonte(fonte);
  const r = opcoes.proporcao ? recorteCentral(largura, altura, opcoes.proporcao) : { x: 0, y: 0, largura, altura };
  const alvo = dimensoesAlvo(r.largura, r.altura);
  const canvas = document.createElement("canvas");
  canvas.width = alvo.largura;
  canvas.height = alvo.altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  if (opcoes.espelhar) {
    ctx.translate(alvo.largura, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(fonte, r.x, r.y, r.largura, r.altura, 0, 0, alvo.largura, alvo.altura);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", QUALIDADE_JPEG));
  if (!blob) throw new Error("falha ao exportar");
  return { blob, largura: alvo.largura, altura: alvo.altura };
}

/** Abre um arquivo de imagem já com a orientação do EXIF aplicada. */
export async function abrirImagem(arquivo: Blob): Promise<Fonte> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      /* formato não suportado pelo bitmap (ex.: HEIC no Chrome): tenta pela <img> */
    }
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Foto da galeria ou do `<input capture>`: orientada, reduzida, JPEG, sem EXIF. */
export async function processarFoto(arquivo: Blob, opcoes: { proporcao?: number } = {}): Promise<FotoProcessada> {
  const fonte = await abrirImagem(arquivo);
  return exportarJpeg(fonte, opcoes);
}
