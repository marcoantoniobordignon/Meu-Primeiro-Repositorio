/**
 * Token assinado (HMAC-SHA-256) que vai no push de dose: deixa o service worker registrar
 * "Tomei"/"Adiar" com o app fechado sem carregar a sessão. Vale só para aquela dose e expira.
 * WebCrypto: roda no Deno (Edge Functions) e no Node (testes).
 */
const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function chave(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

export interface CargaToken {
  dose: string;
  familia: string;
  /** epoch ms */
  exp: number;
}

export async function assinarToken(c: CargaToken, segredo: string): Promise<string> {
  const corpo = `${c.dose}.${c.familia}.${c.exp}`;
  const sig = await crypto.subtle.sign("HMAC", await chave(segredo), enc.encode(corpo));
  return `${corpo}.${b64url(sig)}`;
}

/** A carga, se a assinatura confere e não expirou; senão null. Comparação em tempo constante. */
export async function verificarToken(token: string, segredo: string, agora = Date.now()): Promise<CargaToken | null> {
  const partes = token.split(".");
  if (partes.length !== 4) return null;
  const [dose, familia, exp, sig] = partes as [string, string, string, string];
  const esperado = (await assinarToken({ dose, familia, exp: Number(exp) }, segredo)).split(".")[3]!;
  if (esperado.length !== sig.length) return null;
  let dif = 0;
  for (let i = 0; i < sig.length; i++) dif |= esperado.charCodeAt(i) ^ sig.charCodeAt(i);
  if (dif !== 0 || !Number.isFinite(Number(exp)) || Number(exp) < agora) return null;
  return { dose, familia, exp: Number(exp) };
}
