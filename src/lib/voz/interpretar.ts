import { supabase, supabaseConfigurado, tabela } from "@/lib/supabase/client";

import { interpretarLocal, type ContextoVoz, type Interpretacao, type RegistroVoz } from "./parser";

export interface Resultado extends Interpretacao {
  motor: "servidor" | "local";
  interpretacaoId?: string | null;
}

interface RespostaServidor {
  registros: {
    tipo: string;
    inicio: string;
    fim: string | null;
    bebe_id: string | null;
    dados: { lado: "E" | "D" | "ambos" | null; ml: number | null; tipo_mamada: "peito" | "mamadeira" | "formula" | "bomba" | null; conteudo: "xixi" | "coco" | "ambos" | "seca" | null; texto: string | null; slug: string | null; intensidade: 1 | 2 | 3 | null; quantidade: number | null };
  }[];
  confianca: number;
  resumo: string;
  interpretacao_id?: string | null;
  tentar_local?: boolean;
}

/** Converte a resposta da function para o mesmo formato do parser local. */
function doServidor(r: RespostaServidor): RegistroVoz[] {
  const saida: RegistroVoz[] = [];
  for (const x of r.registros) {
    const bebe_id = x.bebe_id ?? undefined;
    switch (x.tipo) {
      case "sono":
        saida.push({ tipo: "sono", inicio: x.inicio, fim: x.fim, bebe_id });
        break;
      case "mamada":
        saida.push({ tipo: "mamada", inicio: x.inicio, fim: x.fim ?? x.inicio, dados: { tipo: x.dados.tipo_mamada ?? "peito", lado: x.dados.lado, ml: x.dados.ml }, bebe_id });
        break;
      case "fralda":
        saida.push({ tipo: "fralda", inicio: x.inicio, dados: { conteudo: x.dados.conteudo ?? "xixi" }, bebe_id });
        break;
      case "banho":
        saida.push({ tipo: "banho", inicio: x.inicio, bebe_id });
        break;
      case "sintoma":
        if (x.dados.slug) saida.push({ tipo: "sintoma", slug: x.dados.slug, intensidade: x.dados.intensidade ?? 1 });
        break;
      case "chute":
        saida.push({ tipo: "chute", quantidade: x.dados.quantidade ?? 1 });
        break;
      case "contracao":
        saida.push({ tipo: "contracao", inicio: x.inicio, fim: x.fim ?? x.inicio });
        break;
    }
  }
  return saida;
}

/**
 * VOZ-02/08: com rede e Supabase, a Edge Function interpreta; qualquer falha
 * (sem rede, 5xx, limite) cai no parser local de regras.
 */
export async function interpretar(texto: string, ctx: ContextoVoz): Promise<Resultado> {
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  if (supabaseConfigurado() && online) {
    try {
      const sb = await supabase();
      if (sb) {
        const { data, error } = await sb.functions.invoke<RespostaServidor>("interpretar-registro", {
          body: {
            transcricao: texto,
            contexto: {
              modo: ctx.modo,
              agoraLocal: comFuso(ctx.agora),
              bebes: ctx.bebes,
              bebeAtivoId: ctx.bebeAtivoId,
              ultimosRegistros: ctx.ultimosRegistros,
            },
          },
        });
        if (!error && data && !data.tentar_local) {
          return { registros: doServidor(data), confianca: data.confianca, resumo: data.resumo, sugestoes: ctx.modo === "bebe" ? ["mamada", "fralda"] : ["sintoma", "chute"], motor: "servidor", interpretacaoId: data.interpretacao_id };
        }
      }
    } catch {
      /* cai no local */
    }
  }
  return { ...interpretarLocal(texto, ctx), motor: "local" };
}

/** ISO com o fuso do aparelho (VOZ-04), ex. 2026-10-01T03:12:00-03:00. */
export function comFuso(d: Date): string {
  const off = -d.getTimezoneOffset();
  const sinal = off >= 0 ? "+" : "-";
  const p = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  return `${local}${sinal}${p(off / 60)}:${p(off % 60)}`;
}

/** VOZ-10: marca a interpretação como aceita ou corrigida para medir precisão. */
export async function marcarInterpretacao(id: string | null | undefined, campo: "aceita" | "corrigida", valor: boolean) {
  if (!id || !supabaseConfigurado()) return;
  const sb = await supabase();
  if (!sb) return;
  await tabela(sb, "voz_interpretacoes").update({ [campo]: valor }).eq("id", id);
}
