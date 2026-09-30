/**
 * Compila content/**\/*.md (frontmatter + cards separados por "---") e gera as
 * 42 stories "Semana X: o que muda" a partir de supabase/seed/conteudo-semanas.json.
 * Saída: src/conteudo/banco.json, versionado no repo (CON-06: vai no bundle).
 *
 * Uso: pnpm conteudo:build
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pastaContent = path.join(raiz, "content");
const saida = path.join(raiz, "src", "conteudo", "banco.json");

const corPorCategoria = {
  semana: "primaria",
  corpo: "acento",
  bebe: "banho",
  parto: "fralda",
  pos_parto: "acento",
  sono: "sono",
  amamentacao: "mamada",
};

const FRASE_FINAL = "Na dúvida, fale com quem te acompanha.";

function parseFrontmatter(texto, arquivo) {
  const m = texto.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error(`${arquivo}: sem frontmatter`);
  const meta = {};
  for (const linha of m[1].split("\n")) {
    if (!linha.trim()) continue;
    const i = linha.indexOf(":");
    if (i < 0) throw new Error(`${arquivo}: linha inválida no frontmatter: ${linha}`);
    const chave = linha.slice(0, i).trim();
    let valor = linha.slice(i + 1).trim();
    if (/^-?\d+$/.test(valor)) valor = Number(valor);
    else if (valor === "true") valor = true;
    else if (valor === "false") valor = false;
    else if (valor === "null") valor = null;
    meta[chave] = valor;
  }
  return { meta, corpo: m[2].trim() };
}

function cardsDoCorpo(corpo) {
  return corpo
    .split(/\n\s*---\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);
}

async function lerMarkdowns() {
  const arquivos = (await readdir(pastaContent)).filter((f) => f.endsWith(".md")).sort();
  const itens = [];
  for (const nome of arquivos) {
    const texto = await readFile(path.join(pastaContent, nome), "utf8");
    const { meta, corpo } = parseFrontmatter(texto, nome);
    const cards = cardsDoCorpo(corpo);
    const obrigatorios = ["slug", "titulo", "categoria", "minutos_leitura"];
    for (const k of obrigatorios) if (meta[k] === undefined) throw new Error(`${nome}: falta ${k}`);
    const temFaixa = meta.semana_min !== undefined || meta.mes_bebe_min !== undefined;
    if (!temFaixa) throw new Error(`${nome}: precisa de semana_min/max ou mes_bebe_min/max (CON-08)`);
    if (!corPorCategoria[meta.categoria]) throw new Error(`${nome}: categoria desconhecida ${meta.categoria}`);
    itens.push({
      id: meta.slug,
      slug: meta.slug,
      titulo: meta.titulo,
      categoria: meta.categoria,
      cor_token: corPorCategoria[meta.categoria],
      semana_min: meta.semana_min ?? null,
      semana_max: meta.semana_max ?? meta.semana_min ?? null,
      mes_bebe_min: meta.mes_bebe_min ?? null,
      mes_bebe_max: meta.mes_bebe_max ?? meta.mes_bebe_min ?? null,
      dia_da_semana: meta.dia_da_semana ?? null,
      minutos_leitura: meta.minutos_leitura,
      premium: meta.premium === true,
      publicado: meta.publicado !== false,
      cards,
      corpo_md: corpo,
    });
  }
  return itens;
}

async function storiesDasSemanas() {
  const semanas = JSON.parse(await readFile(path.join(raiz, "supabase", "seed", "conteudo-semanas.json"), "utf8"));
  return semanas.map((s) => {
    const n = String(s.semana).padStart(2, "0");
    const medidas = s.comprimento !== "—" ? `\n\n≈ ${s.comprimento} · ${s.peso}` : "";
    const cards = [
      `${s.emoji}\n\n**Do tamanho de ${s.tamanho}.**${medidas}`,
      s.frase,
      s.dica,
      FRASE_FINAL,
    ];
    return {
      id: `semana-${n}`,
      slug: `semana-${n}`,
      titulo: `Semana ${s.semana}: o que muda`,
      categoria: "semana",
      cor_token: "primaria",
      semana_min: s.semana,
      semana_max: s.semana,
      mes_bebe_min: null,
      mes_bebe_max: null,
      dia_da_semana: null,
      minutos_leitura: 1,
      premium: false, // CON-05: a story da semana nunca é premium
      publicado: true,
      cards,
      corpo_md: cards.join("\n\n---\n\n"),
    };
  });
}

const banco = [...(await storiesDasSemanas()), ...(await lerMarkdowns())];
const slugs = new Set();
for (const c of banco) {
  if (slugs.has(c.slug)) throw new Error(`slug duplicado: ${c.slug}`);
  slugs.add(c.slug);
}
await writeFile(saida, JSON.stringify(banco, null, 2) + "\n");
console.log(`banco.json: ${banco.length} conteúdos (${banco.length - 42} artigos + 42 semanas)`);
