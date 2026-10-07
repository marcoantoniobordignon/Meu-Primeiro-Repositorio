"use client";

import { nameVotes, type NameVote } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import { temServidor } from "@/lib/familia/servidor";
import { sincronizar } from "@/lib/offline/sync";
import { atualizarPerfil } from "@/lib/perfil";
import { chamarRpc, supabase, supabaseConfigurado } from "@/lib/supabase/client";
import { chaveDoVoto, idDoVoto, nomeDoCatalogo, nomeProprioValido, normalizarNomeProprio, novasPosicoes, type VotoNome } from "@dominio/nomes.ts";

let timerSync: ReturnType<typeof setTimeout> | undefined;
/** Curtir pode criar um match no servidor: sobe logo (com rede) para a animação chegar sem esperar o ciclo de 60 s. */
function sincronizarEmBreve() {
  if (!temServidor()) return;
  clearTimeout(timerSync);
  timerSync = setTimeout(() => void sincronizar(), 1500);
}

/** RN-02/03: votar (ou mudar o voto). Uma linha por pessoa e nome: desfazer e votar de novo reaproveita o id. */
export function votar(alvo: { name_id: string | null; custom_name: string | null }, vote: VotoNome): NameVote {
  const chave = chaveDoVoto(alvo);
  const id = idDoVoto(meuId(), chave);
  const antes = nameVotes.listarTodos().find((v) => v.id === id);
  const salvo = nameVotes.salvar({
    id,
    name_id: alvo.name_id,
    custom_name: alvo.custom_name ? normalizarNomeProprio(alvo.custom_name) : null,
    vote,
    // Descartar tira do ranking; curtir de novo não devolve a posição.
    rank: vote === "like" && antes && !antes.apagado_em ? antes.rank : null,
    criado_por: meuId(),
    apagado_em: null,
  });
  if (vote === "like") sincronizarEmBreve();
  return salvo;
}

/** RN-02: "Desfazer" anula o voto (a carta volta ao baralho). */
export function desfazerVoto(id: string): void {
  nameVotes.apagar(id);
}

export type ErroNomeProprio = "invalido";

/** RN-10: nome próprio vira "like". Se já está no catálogo, vota no do catálogo (conta para o match igual). */
export function adicionarNomeProprio<N extends { id: string; name: string }>(texto: string, catalogo: N[]): { voto: NameVote; doCatalogo: boolean } | ErroNomeProprio {
  if (!nomeProprioValido(texto)) return "invalido";
  const existente = nomeDoCatalogo(catalogo, texto);
  const voto = existente ? votar({ name_id: existente.id, custom_name: null }, "like") : votar({ name_id: null, custom_name: normalizarNomeProprio(texto) }, "like");
  return { voto, doCatalogo: Boolean(existente) };
}

/** RN-04: grava a ordem nova do top 10 (só o que mudou; o banco garante uma posição por pessoa). */
export function salvarRanking(ordem: string[]): number {
  const votos = nameVotes.listar();
  const mudancas = novasPosicoes(votos, ordem);
  // Primeiro quem sai da posição, depois quem entra: a fila sobe nessa ordem.
  for (const m of [...mudancas.filter((x) => x.rank === null), ...mudancas.filter((x) => x.rank !== null)]) {
    const v = votos.find((x) => x.id === m.id)!;
    nameVotes.salvar({ ...v, rank: m.rank });
  }
  return mudancas.length;
}

export class ErroEscolha extends Error {}

/**
 * RN-07: "Este é o nome!". Com servidor, a RPC confere o match e grava para a família (pede rede); sem servidor,
 * fica no aparelho. Em ambos, o app passa a mostrar o nome.
 */
export async function escolherNome(chave: string, nome: string): Promise<string> {
  // Com servidor configurado, a escolha é da família: sem rede, pede conexão (nunca grava só aqui).
  if (supabaseConfigurado()) {
    if (!temServidor()) throw new ErroEscolha("sem_rede");
    const sb = await supabase();
    if (!sb) throw new ErroEscolha("sem_rede");
    const { data, error } = await chamarRpc<string>(sb, "escolher_nome", { p_chave: chave });
    if (error || !data) throw new ErroEscolha(error?.message?.includes("nome_sem_match") ? "nome_sem_match" : "desconhecido");
    atualizarPerfil({ nomeDoBebe: data });
    return data;
  }
  atualizarPerfil({ nomeDoBebe: nome });
  return nome;
}

export async function desfazerNome(): Promise<void> {
  if (supabaseConfigurado()) {
    if (!temServidor()) throw new ErroEscolha("sem_rede");
    const sb = await supabase();
    if (!sb) throw new ErroEscolha("sem_rede");
    const { error } = await chamarRpc(sb, "desfazer_nome");
    if (error) throw new ErroEscolha("desconhecido");
  }
  atualizarPerfil({ nomeDoBebe: null });
}
