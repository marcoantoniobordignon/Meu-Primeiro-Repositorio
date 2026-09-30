import { bancoBruto, type Conteudo } from "@/lib/conteudo/banco";
import { paraISO, somarDias } from "@/lib/dates";

import type { Distribuicoes, FamiliaResumo, FonteAdmin, Leitura, PontoDia, Resumo, VozResumo } from "./tipos";

/**
 * Fonte de demonstração: números plausíveis e determinísticos, para o painel
 * ter cara de painel antes do Supabase estar ligado. Nada aqui é real.
 * O conteúdo editado fica no localStorage deste navegador.
 */
const CHAVE_CONTEUDO = "ninho.admin.demo.conteudos";

function prng(semente: number): () => number {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function serieDemo(dias: number, hoje = paraISO(new Date())): PontoDia[] {
  const rnd = prng(7);
  const saida: PontoDia[] = [];
  const total = 120;
  for (let i = 0; i < total; i++) {
    const dia = somarDias(hoje, i - (total - 1));
    const fimDeSemana = [0, 6].includes(new Date(`${dia}T12:00:00`).getDay());
    const crescimento = 1 + i / 40;
    const novas = Math.round((2 + rnd() * 3) * crescimento * (fimDeSemana ? 0.7 : 1));
    const base = 20 + i * 1.6;
    const ativas = Math.round(base * (0.55 + rnd() * 0.2) * (fimDeSemana ? 0.85 : 1));
    saida.push({
      dia,
      novas,
      ativas,
      registros: Math.round(ativas * (2.4 + rnd() * 1.2)),
      leituras: Math.round(ativas * (0.9 + rnd() * 0.5)),
    });
  }
  return saida.slice(-dias);
}

function contagens(chaves: string[], pesos: number[], total: number): { chave: string; n: number }[] {
  const soma = pesos.reduce((a, b) => a + b, 0);
  return chaves.map((chave, i) => ({ chave, n: Math.round((total * (pesos[i] ?? 0)) / soma) }));
}

function lerOverrides(): Record<string, Conteudo | null> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_CONTEUDO) ?? "{}") as Record<string, Conteudo | null>;
  } catch {
    return {};
  }
}

function guardarOverrides(o: Record<string, Conteudo | null>) {
  try {
    localStorage.setItem(CHAVE_CONTEUDO, JSON.stringify(o));
  } catch {
    /* sem storage: fica só em memória nesta sessão */
  }
}

const atraso = () => new Promise<void>((r) => setTimeout(r, 120));

export const fonteDemo: FonteAdmin = {
  nome: "demo",

  async resumo(): Promise<Resumo> {
    await atraso();
    const s = serieDemo(120);
    const familias = s.reduce((a, p) => a + p.novas, 0);
    const ult = (n: number, campo: keyof PontoDia) => s.slice(-n).reduce((a, p) => a + (p[campo] as number), 0);
    const ativas7d = Math.round(Math.max(...s.slice(-7).map((p) => p.ativas)) * 1.6);
    return {
      familias,
      familias_7d: ult(7, "novas"),
      familias_30d: ult(30, "novas"),
      ativas_1d: s[s.length - 1]!.ativas,
      ativas_7d: ativas7d,
      ativas_30d: Math.round(ativas7d * 1.9),
      gestacao: Math.round(familias * 0.62),
      bebe: Math.round(familias * 0.38),
      plano_ativo: Math.round(familias * 0.07),
      trial: Math.round(familias * 0.04),
      cortesia: Math.round(familias * 0.02),
      membros: Math.round(familias * 1.35),
      cuidadores: Math.round(familias * 0.35),
      registros_7d: ult(7, "registros"),
      sintomas_7d: Math.round(ult(7, "ativas") * 0.5),
      leituras_7d: ult(7, "leituras"),
      voz_7d: Math.round(ult(7, "registros") * 0.18),
      onboarding_concluido: Math.round(familias * 0.81),
      perfis: Math.round(familias * 1.35),
      com_email: Math.round(familias * 0.29),
    };
  },

  async serie(dias) {
    await atraso();
    return serieDemo(dias);
  },

  async distribuicoes(): Promise<Distribuicoes> {
    await atraso();
    const rnd = prng(11);
    const semanas = Array.from({ length: 42 }, (_, i) => {
      const s = i + 1;
      const pico = Math.exp(-((s - 24) ** 2) / 260);
      return { chave: String(s), n: Math.round(2 + pico * 22 + rnd() * 3) };
    });
    const meses = Array.from({ length: 13 }, (_, m) => ({ chave: String(m), n: Math.round(18 * Math.exp(-m / 4) + 1 + rnd() * 2) }));
    return {
      semanas,
      meses_bebe: meses,
      papeis: contagens(["mae", "parceiro", "avo", "cuidador"], [100, 24, 8, 3], 420),
      tipos_registro: contagens(["mamada", "sono", "fralda", "banho", "outro"], [46, 28, 20, 4, 2], 6800),
      origens_registro: contagens(["manual", "timer", "voz"], [61, 24, 15], 6800),
      sintomas: contagens(["cansaco", "enjoo", "azia", "dor_costas", "insonia", "inchaco", "dor_cabeca", "ansiedade", "caibra", "tontura"], [31, 27, 19, 17, 14, 12, 10, 9, 6, 4], 1300),
      planos: contagens(["free", "ativo", "trial", "expirado"], [87, 7, 4, 2], 310),
    };
  },

  async familias(limite, offset): Promise<FamiliaResumo[]> {
    await atraso();
    const rnd = prng(23 + offset);
    const agora = Date.now();
    const lista: FamiliaResumo[] = [];
    for (let i = 0; i < limite; i++) {
      const bebe = rnd() < 0.38;
      const idade = (offset + i) * 3.2 + rnd() * 20;
      const criado = new Date(agora - idade * 86_400_000 - rnd() * 86_400_000);
      const ultimo = new Date(agora - (offset + i) * 2.1 * 3_600_000 - rnd() * 3_600_000);
      lista.push({
        id: `${(0x1000 + Math.floor(rnd() * 0xefff)).toString(16)}${(0x1000 + Math.floor(rnd() * 0xefff)).toString(16)}-demo`,
        modo: bebe ? "bebe" : "gestacao",
        semana: bebe ? null : 8 + Math.floor(rnd() * 32),
        mes_bebe: bebe ? Math.floor(rnd() * 9) : null,
        membros: 1 + (rnd() < 0.3 ? 1 : 0) + (rnd() < 0.08 ? 1 : 0),
        plano: rnd() < 0.08 ? "ativo" : rnd() < 0.05 ? "trial" : "free",
        criado_em: criado.toISOString(),
        ultimo_acesso_em: ultimo.toISOString(),
        registros: bebe ? Math.round(idade * (3 + rnd() * 4)) : Math.round(rnd() * 12),
      });
    }
    return lista;
  },

  async leituras(): Promise<Leitura[]> {
    await atraso();
    const rnd = prng(31);
    return bancoBruto.filter((c) => c.publicado).map((c) => {
      const base = c.categoria === "semana" ? 40 : 90;
      const leituras = Math.round(base * (0.3 + rnd()));
      return { conteudo_id: c.id, leituras, guardados: Math.round(leituras * rnd() * 0.25) };
    });
  },

  async voz(limite): Promise<VozResumo> {
    await atraso();
    const rnd = prng(41);
    const frases: [string, unknown][] = [
      ["mamou dez minutos no peito esquerdo", { registros: [{ tipo: "mamada", dados: { tipo: "peito", lado: "E" }, minutos: 10 }] }],
      ["dormiu agora", { registros: [{ tipo: "sono" }] }],
      ["fralda de xixi e cocô", { registros: [{ tipo: "fralda", dados: { conteudo: "ambos" } }] }],
      ["tomou 120 ml de fórmula às sete", { registros: [{ tipo: "mamada", dados: { tipo: "formula", ml: 120 } }] }],
      ["acordou faz meia hora", { registros: [{ tipo: "sono", fim: "-30min" }] }],
      ["hoje tô com muita azia e cansada", { registros: [{ tipo: "sintoma", slug: "azia", intensidade: 3 }, { tipo: "sintoma", slug: "cansaco", intensidade: 2 }] }],
      ["banho dado", { registros: [{ tipo: "banho" }] }],
      ["chutou bastante depois do almoço", { registros: [] }],
      ["mamou dos dois lados uns vinte minutos", { registros: [{ tipo: "mamada", dados: { tipo: "peito", lado: "ambos" }, minutos: 20 }] }],
      ["deu 90 de mamadeira", { registros: [{ tipo: "mamada", dados: { tipo: "mamadeira", ml: 90 } }] }],
    ];
    const recentes = Array.from({ length: Math.min(limite, 24) }, (_, i) => {
      const [transcricao, resposta] = frases[i % frases.length]!;
      const conf = 0.55 + rnd() * 0.45;
      const aceita = conf > 0.7 ? rnd() < 0.9 : rnd() < 0.5;
      return {
        id: `demo-${i}`,
        transcricao,
        resposta,
        confianca: Math.round(conf * 100) / 100,
        aceita,
        corrigida: !aceita && rnd() < 0.6,
        ms_total: Math.round(700 + rnd() * 900),
        criado_em: new Date(Date.now() - i * 47 * 60_000).toISOString(),
      };
    });
    return { total: 1184, total_30d: 412, aceitas: 962, corrigidas: 141, nao_entendidas: 81, confianca_media: 0.84, ms_mediano: 1120, recentes };
  },

  async conteudos(): Promise<Conteudo[]> {
    const o = lerOverrides();
    const base = bancoBruto.map((c) => (o[c.id] === undefined ? c : o[c.id])).filter((c): c is Conteudo => c !== null);
    const novos = Object.values(o).filter((c): c is Conteudo => c !== null && !bancoBruto.some((b) => b.id === c.id));
    return [...base, ...novos];
  },

  async salvarConteudo(c) {
    const o = lerOverrides();
    o[c.id] = c;
    guardarOverrides(o);
  },

  async apagarConteudo(id) {
    const o = lerOverrides();
    o[id] = null;
    guardarOverrides(o);
  },
};
