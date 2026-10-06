/**
 * Intenções da captura por voz que não viram registro do bebê nem sintoma:
 * "tomei o ferro" (funcionalidade 02 RN-12) e "pergunta para o médico: ..." (04 RN-08).
 * Resolvidas no aparelho, antes do parser/LLM, para nada de medicamento sair do app.
 */
import { intencaoTomei } from "@/lib/medicamentos/regras";

const DESTINO = String.raw`(?:pr[oa]|para (?:o|a)|pro|ao|à|a)\s+(?:m[ée]dic[oa]|doutor(?:a)?|dr[ao]?\.?|obstetra|consulta|pr[ée][- ]?natal)`;
const PADROES = [
  new RegExp(String.raw`^(?:anot[ae]r?|guard[ae]r?|coloc[ae]r?)?\s*(?:uma\s+)?pergunta\s+${DESTINO}\b[\s:,.;-]*(.+)$`, "i"),
  new RegExp(String.raw`^(?:quero\s+|preciso\s+|vou\s+)?(?:lembrar\s+de\s+)?perguntar\s+${DESTINO}\b[\s:,.;-]*(?:se\s+|sobre\s+)?(.+)$`, "i"),
  new RegExp(String.raw`^(?:lembrar\s+de\s+)?perguntar\s+(?:se\s+|sobre\s+)?(.+?)\s+${DESTINO}\s*$`, "i"),
];

/** Texto da pergunta, ou null se a frase não é "pergunta para o médico". */
export function intencaoPergunta(transcricao: string): string | null {
  const t = transcricao.trim().replace(/\s+/g, " ");
  for (const p of PADROES) {
    const m = p.exec(t);
    const texto = m?.[1]?.trim().replace(/^(?:se|sobre)\s+/i, "").replace(/[\s.,;:-]+$/, "");
    if (texto) {
      const frase = texto.charAt(0).toUpperCase() + texto.slice(1);
      return /[?]$/.test(frase) ? frase : `${frase}?`;
    }
  }
  return null;
}

export type IntencaoLocal = { tipo: "remedio"; nome: string } | { tipo: "pergunta"; texto: string } | null;

export function intencaoLocal(transcricao: string): IntencaoLocal {
  const pergunta = intencaoPergunta(transcricao);
  if (pergunta) return { tipo: "pergunta", texto: pergunta };
  const nome = intencaoTomei(transcricao);
  if (nome !== null) return { tipo: "remedio", nome };
  return null;
}
