/**
 * Parser local de regras (VOZ-08): tipos + minutos + lado + horário relativo.
 * É o caminho principal enquanto a Edge Function não existe, e o fallback sem rede depois.
 * Função pura: recebe a transcrição e o contexto, devolve registros com confiança.
 */
import { catalogo } from "@/lib/sintomas/catalogo";

export type ModoVoz = "gestacao" | "bebe";

export interface ContextoVoz {
  modo: ModoVoz;
  agora: Date;
  /** Nomes dos bebês para trocar o bebê ativo (BEB-11). */
  bebes?: { id: string; nome: string }[];
  bebeAtivoId?: string;
  sonoEmAndamento?: boolean;
  /** VOZ-03: só os últimos 3 registros do bebê vão para a function, nunca o histórico. */
  ultimosRegistros?: { tipo: string; inicio: string; fim: string | null; resumo: string }[];
}

export type RegistroVoz =
  | { tipo: "sono"; inicio: string; fim: string | null; bebe_id?: string }
  | { tipo: "acordou"; fim: string; bebe_id?: string }
  | { tipo: "mamada"; inicio: string; fim: string; dados: { tipo: "peito" | "mamadeira" | "formula" | "bomba"; lado: "E" | "D" | "ambos" | null; ml: number | null }; bebe_id?: string }
  | { tipo: "fralda"; inicio: string; dados: { conteudo: "xixi" | "coco" | "ambos" | "seca" }; bebe_id?: string }
  | { tipo: "banho"; inicio: string; bebe_id?: string }
  | { tipo: "sintoma"; slug: string; intensidade: 1 | 2 | 3 }
  | { tipo: "chute"; quantidade: number }
  | { tipo: "contracao"; inicio: string; fim: string };

export interface Interpretacao {
  registros: RegistroVoz[];
  confianca: number;
  resumo: string;
  /** Tipos sugeridos quando não entendeu (estado "não entendi"). */
  sugestoes: string[];
}

const numerosPorExtenso: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, três: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10,
  onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  meia: 30, meio: 30,
};

function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "doze", "12", "vinte e cinco", "meia" → número. */
function numero(texto: string): number | null {
  const t = texto.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const partes = t.split(/\s+e\s+/);
  let total = 0;
  for (const p of partes) {
    const n = numerosPorExtenso[p.trim()];
    if (n === undefined) return null;
    total += n;
  }
  return total || null;
}

const NUM = "(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|vinte(?: e \\w+)?|trinta(?: e \\w+)?|quarenta(?: e \\w+)?|cinquenta(?: e \\w+)?|sessenta|meia|meio|cem|cento(?: e \\w+)?)";

/** Duração em minutos: "12 minutos", "meia hora", "1 hora e 20", "45 segundos" (→ fração). */
function duracaoMin(t: string): number | null {
  const h = t.match(new RegExp(`${NUM} horas?(?: e ${NUM}(?! ?(?:ml|segundos?|minutos?|min\\b)))?`));
  const m = t.match(new RegExp(`${NUM} (?:minutos?|min)\\b`));
  const s = t.match(new RegExp(`${NUM} segundos?`));
  let total = 0;
  let achou = false;
  if (h) {
    const n = numero(h[1]!);
    if (n !== null) {
      total += h[1] === "meia" || h[1] === "meio" ? 30 : n * 60;
      achou = true;
      // "uma hora e vinte" → 20 minutos sem unidade.
      if (h[2]) {
        const extra = numero(h[2]);
        if (extra !== null) total += extra;
      }
    }
  }
  if (m) {
    const n = numero(m[1]!);
    if (n !== null) {
      total += n;
      achou = true;
    }
  }
  if (s) {
    const n = numero(s[1]!);
    if (n !== null) {
      total += n / 60;
      achou = true;
    }
  }
  return achou ? total : null;
}

/**
 * "há 20 minutos", "meia hora atrás", "às 3 e meia", "agora" → instante de referência.
 * Devolve também a cláusula sem o trecho consumido, para a duração não o reler.
 */
function momento(t: string, agora: Date): { quando: Date; explicito: boolean; resto: string } {
  const atras = t.match(new RegExp(`(?:ha|faz) ${NUM} (minutos?|min|horas?)\\b|${NUM} (minutos?|min|horas?) atras`));
  if (atras) {
    const bruto = atras[1] ?? atras[3] ?? "";
    const n = numero(bruto);
    const unidade = atras[2] ?? atras[4] ?? "";
    if (n !== null) {
      const ms = bruto === "meia" || bruto === "meio" ? 30 * 60_000 : unidade.startsWith("h") ? n * 3_600_000 : n * 60_000;
      return { quando: new Date(agora.getTime() - ms), explicito: true, resto: t.replace(atras[0], " ") };
    }
  }
  const hora = t.match(/\b(?:as|a partir das|desde as) (\d{1,2})(?::(\d{2}))?(?: e (meia|\d{1,2}))?(?: horas?)?\b/);
  if (hora) {
    const h = Number(hora[1]);
    let min = hora[2] ? Number(hora[2]) : 0;
    if (hora[3]) min = hora[3] === "meia" ? 30 : Number(hora[3]);
    if (h <= 23 && min <= 59) {
      const d = new Date(agora);
      d.setHours(h, min, 0, 0);
      if (d > agora) d.setDate(d.getDate() - 1);
      return { quando: d, explicito: true, resto: t.replace(hora[0], " ") };
    }
  }
  return { quando: agora, explicito: false, resto: t };
}

function lado(t: string): "E" | "D" | "ambos" | null {
  const e = /\b(esquerd[oa]|lado e)\b/.test(t);
  const d = /\b(direit[oa]|lado d)\b/.test(t);
  if (e && d) return "ambos";
  if (e) return "E";
  if (d) return "D";
  if (/\b(n?os) dois\b|\bambos\b|\bdois lados\b/.test(t)) return "ambos";
  return null;
}

function bebeMencionado(t: string, ctx: ContextoVoz): string | undefined {
  for (const b of ctx.bebes ?? []) {
    if (b.id !== ctx.bebeAtivoId && new RegExp(`\\b${normalizar(b.nome)}\\b`).test(t)) return b.id;
  }
  return undefined;
}

/** Divide "mamou 10 min e trocou fralda" em cláusulas por " e " quando há verbo dos dois lados. */
function clausulas(t: string): string[] {
  const verbos = /\b(mamou|dormiu|acordou|trocou|fralda|banho|tomou|chutou|chute|contracao|senti|estou|com|tirou)\b/;
  const partes = t.split(/\s+e\s+(?=\w)/);
  const saida: string[] = [];
  let atual = "";
  for (const p of partes) {
    if (atual && verbos.test(p) && !/^(meia|\d+|um|uma|dois|duas|tres|quatro|cinco|dez|quinze|vinte|trinta)\b/.test(p)) {
      saida.push(atual);
      atual = p;
    } else {
      atual = atual ? `${atual} e ${p}` : p;
    }
  }
  if (atual) saida.push(atual);
  return saida;
}

function interpretarBebe(c: string, ctx: ContextoVoz): RegistroVoz | null {
  const { quando, explicito, resto } = momento(c, ctx.agora);
  const dur = duracaoMin(resto);
  const bebe_id = bebeMencionado(c, ctx);

  if (/\bacordou\b|\bdespertou\b/.test(c)) return { tipo: "acordou", fim: quando.toISOString(), bebe_id };

  if (/\b(dormiu|dormindo|soneca|caiu no sono|pegou no sono|apagou)\b/.test(c)) {
    if (dur !== null) {
      const fim = explicito ? new Date(quando.getTime() + dur * 60_000) : quando;
      const inicio = explicito ? quando : new Date(quando.getTime() - dur * 60_000);
      return { tipo: "sono", inicio: inicio.toISOString(), fim: fim.toISOString(), bebe_id };
    }
    if (ctx.sonoEmAndamento) return null;
    return { tipo: "sono", inicio: quando.toISOString(), fim: null, bebe_id };
  }

  if (/\b(mamou|mamada|mamadeira|peito|formula|bomba|tirou leite|extra[iu])\b/.test(c)) {
    const ml = c.match(new RegExp(`${NUM} (?:ml|mililitros?)\\b`));
    const mlN = ml ? numero(ml[1]!) : null;
    const tipo: "peito" | "mamadeira" | "formula" | "bomba" = /\bbomba\b|tirou leite|extra/.test(c)
      ? "bomba"
      : /\bformula\b/.test(c)
        ? "formula"
        : /\bmamadeira\b/.test(c) || mlN !== null
          ? "mamadeira"
          : "peito";
    const fim = explicito && dur !== null ? new Date(quando.getTime() + dur * 60_000) : quando;
    const inicio = dur !== null ? new Date(fim.getTime() - dur * 60_000) : fim;
    return { tipo: "mamada", inicio: inicio.toISOString(), fim: fim.toISOString(), dados: { tipo, lado: tipo === "peito" || tipo === "bomba" ? lado(c) : null, ml: mlN }, bebe_id };
  }

  if (/\bfralda\b|\bxixi\b|\bcoco\b|\btrocou\b/.test(c)) {
    const xixi = /\bxixi\b|\bmolhada\b/.test(c);
    const coco = /\bcoco\b|\bsuja\b/.test(c);
    const conteudo = xixi && coco ? "ambos" : coco ? "coco" : xixi ? "xixi" : /\bseca\b|\blimpa\b/.test(c) ? "seca" : "xixi";
    return { tipo: "fralda", inicio: quando.toISOString(), dados: { conteudo }, bebe_id };
  }

  if (/\bbanho\b/.test(c)) return { tipo: "banho", inicio: quando.toISOString(), bebe_id };
  return null;
}

function interpretarGestacao(c: string, ctx: ContextoVoz): RegistroVoz | null {
  if (/\bchut(e|ou|es)\b|\bmexeu\b/.test(c)) {
    const n = c.match(new RegExp(`${NUM} chutes?`));
    return { tipo: "chute", quantidade: n ? (numero(n[1]!) ?? 1) : 1 };
  }
  if (/\bcontracao\b|\bcontracoes\b/.test(c)) {
    const { quando, resto } = momento(c, ctx.agora);
    const dur = duracaoMin(resto) ?? 1;
    return { tipo: "contracao", inicio: new Date(quando.getTime() - dur * 60_000).toISOString(), fim: quando.toISOString() };
  }
  for (const item of catalogo) {
    if (item.especial) continue;
    const nome = normalizar(item.nome);
    const raiz = nome.replace(/^(muita|muito|dor de|dor nas|dor na|bem|seios|falta de|pressao na|sonhos|humor|choro)\s+/, "");
    if (new RegExp(`\\b${nome}\\b`).test(c) || (raiz.length > 4 && new RegExp(`\\b${raiz}`).test(c))) {
      const intensidade: 1 | 2 | 3 = /\bforte\b|\bmuito\b|\bdemais\b/.test(c) ? 3 : /\bincomod|\bmedi[ao]\b/.test(c) ? 2 : 1;
      return { tipo: "sintoma", slug: item.slug, intensidade };
    }
  }
  return null;
}

function resumir(r: RegistroVoz): string {
  const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  switch (r.tipo) {
    case "sono":
      return r.fim ? `Sono de ${Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 60_000)} min` : `Sono começou às ${hora(r.inicio)}`;
    case "acordou":
      return `Acordou às ${hora(r.fim)}`;
    case "mamada": {
      const min = Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 60_000);
      const lado = r.dados.lado === "E" ? "no esquerdo" : r.dados.lado === "D" ? "no direito" : r.dados.lado === "ambos" ? "nos dois" : "";
      const ml = r.dados.ml ? `${r.dados.ml} ml` : "";
      const t = r.dados.tipo === "peito" ? "Mamada" : r.dados.tipo === "bomba" ? "Bomba" : r.dados.tipo === "formula" ? "Fórmula" : "Mamadeira";
      return [t, lado, ml, min > 0 ? `${min} min` : ""].filter(Boolean).join(" ").replace(/\s+/g, " ").trim().replace(/^(\S+) (.+)$/, "$1 $2").replace(/(\S) (\d+ min)$/, "$1, $2");
    }
    case "fralda":
      return `Fralda de ${r.dados.conteudo === "coco" ? "cocô" : r.dados.conteudo}`;
    case "banho":
      return "Banho";
    case "sintoma":
      return `${catalogo.find((i) => i.slug === r.slug)?.nome ?? r.slug}${r.intensidade === 3 ? " forte" : r.intensidade === 2 ? " incômodo" : ""}`;
    case "chute":
      return r.quantidade === 1 ? "1 chute" : `${r.quantidade} chutes`;
    case "contracao":
      return `Contração de ${Math.round((new Date(r.fim).getTime() - new Date(r.inicio).getTime()) / 1000)} s`;
  }
}

/** Entrada principal. Confiança < 0,6 significa "não entendi" (VOZ-06). */
export function interpretarLocal(transcricao: string, ctx: ContextoVoz): Interpretacao {
  const t = normalizar(transcricao);
  if (!t) return { registros: [], confianca: 0, resumo: "", sugestoes: [] };

  const partes = clausulas(t).slice(0, 3); // VOZ-07
  const registros: RegistroVoz[] = [];
  for (const c of partes) {
    const r = ctx.modo === "bebe" ? interpretarBebe(c, ctx) : interpretarGestacao(c, ctx);
    if (r) registros.push(r);
  }

  // Horário no futuro invalida (VOZ-06).
  const futuro = registros.some((r) => {
    const ref = "fim" in r && r.fim ? r.fim : "inicio" in r ? r.inicio : null;
    return ref !== null && new Date(ref).getTime() > ctx.agora.getTime() + 60_000;
  });

  if (registros.length === 0 || futuro) {
    const sugestoes = ctx.modo === "bebe" ? ["mamada", "fralda"] : ["sintoma", "chute"];
    return { registros: [], confianca: registros.length ? 0.3 : 0, resumo: "", sugestoes };
  }

  // Confiança: cheia quando todas as cláusulas viraram registro; cai por cláusula ignorada.
  const confianca = Math.max(0.6, 0.95 - 0.2 * (partes.length - registros.length));
  return { registros, confianca, resumo: registros.map(resumir).join(" · "), sugestoes: [] };
}
