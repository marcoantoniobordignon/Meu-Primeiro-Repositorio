"use client";

import { useParams, useSearchParams } from "next/navigation";

import { LeitorStory } from "@/components/features/conteudo/LeitorStory";

/** Fora do shell com TabBar: o leitor é tela cheia. */
export default function PaginaStory() {
  const { id } = useParams<{ id: string }>();
  const busca = useSearchParams();
  const posicao = Number(busca.get("p") ?? 0);
  return <LeitorStory id={id} posicao={Number.isFinite(posicao) ? posicao : 0} />;
}
