import type { Conteudo } from "@/lib/conteudo/banco";
import { chamarRpc, supabase, tabela } from "@/lib/supabase/client";

import type { Distribuicoes, FamiliaResumo, FonteAdmin, Leitura, PontoDia, Resumo, VozResumo } from "./tipos";

async function cliente() {
  const sb = await supabase();
  if (!sb) throw new Error("Supabase não configurado");
  return sb;
}

function ou<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  if (r.data === null) throw new Error("sem dados");
  return r.data;
}

/** Fonte real: só RPCs security definer que exigem eh_admin() (0002_admin.sql). */
export const fonteSupabase: FonteAdmin = {
  nome: "supabase",

  async resumo(): Promise<Resumo> {
    return ou(await chamarRpc<Resumo>(await cliente(), "admin_resumo"));
  },

  async serie(dias): Promise<PontoDia[]> {
    return ou(await chamarRpc<PontoDia[]>(await cliente(), "admin_serie_diaria", { p_dias: dias }));
  },

  async distribuicoes(): Promise<Distribuicoes> {
    const d = ou(await chamarRpc<Distribuicoes>(await cliente(), "admin_distribuicoes"));
    // O jsonb devolve a chave como número em alguns agrupamentos; o painel trabalha com texto.
    const texto = (l: { chave: unknown; n: number }[]) => l.map((x) => ({ chave: String(x.chave), n: Number(x.n) }));
    return {
      semanas: texto(d.semanas),
      meses_bebe: texto(d.meses_bebe),
      papeis: texto(d.papeis),
      tipos_registro: texto(d.tipos_registro),
      origens_registro: texto(d.origens_registro),
      sintomas: texto(d.sintomas),
      planos: texto(d.planos),
    };
  },

  async familias(limite, offset): Promise<FamiliaResumo[]> {
    return ou(await chamarRpc<FamiliaResumo[]>(await cliente(), "admin_familias", { p_limite: limite, p_offset: offset }));
  },

  async leituras(): Promise<Leitura[]> {
    return ou(await chamarRpc<Leitura[]>(await cliente(), "admin_leituras"));
  },

  async voz(limite): Promise<VozResumo> {
    const v = ou(await chamarRpc<VozResumo>(await cliente(), "admin_voz", { p_limite: limite }));
    return { ...v, confianca_media: v.confianca_media === null ? null : Number(v.confianca_media), ms_mediano: v.ms_mediano === null ? null : Number(v.ms_mediano) };
  },

  async conteudos(): Promise<Conteudo[]> {
    const sb = await cliente();
    const r = await tabela(sb, "conteudos").select("*").order("atualizado_em", { ascending: false }).limit(2000);
    return ou(r) as Conteudo[];
  },

  async salvarConteudo(c) {
    const sb = await cliente();
    const r = await tabela(sb, "conteudos").upsert({ ...c, atualizado_em: new Date().toISOString() }, { onConflict: "id" });
    if (r.error) throw new Error(r.error.message);
  },

  async apagarConteudo(id) {
    const sb = await cliente();
    const r = await tabela(sb, "conteudos").delete().eq("id", id);
    if (r.error) throw new Error(r.error.message);
  },
};
