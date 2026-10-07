"use client";

import { Heart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { nomesCopy as copy } from "@/copy/nomes";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { nameMatches, nomesRemotos, type NameMatch } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";

const CHAVE = "ninho.nomes.celebrados";
const RECENTE_MS = 2 * 86_400_000;

function celebrados(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CHAVE) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/**
 * RN-05: quem curtiu por último vê "Deu match" (o primeiro recebe o push). Mostra uma vez por match, só para
 * matches recentes (um aparelho novo não celebra o que já passou). Não usa o catálogo inteiro (só o baixado).
 */
export function CelebracaoMatch() {
  const router = useRouter();
  const { meuId } = useFamilia();
  const matches = useColecao(nameMatches);
  const catalogo = useColecao(nomesRemotos);
  const [atual, setAtual] = useState<NameMatch | null>(null);

  useEffect(() => {
    if (atual) return;
    const ja = new Set(celebrados());
    const novo = matches.find((m) => m.segundo === meuId && !ja.has(m.id) && Date.now() - new Date(m.criado_em).getTime() < RECENTE_MS);
    if (!novo) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify([...ja, novo.id].slice(-200)));
    } catch {
      /* nada */
    }
    track("names_match_created", {});
    setAtual(novo);
  }, [matches, meuId, atual]);

  if (!atual) return null;
  const nome = atual.name_id ? (catalogo.find((n) => n.id === atual.name_id)?.name ?? "") : (atual.custom_name ?? "");
  return (
    <Sheet aberto onFechar={() => setAtual(null)} titulo={copy.match.titulo}>
      <div className="flex flex-col items-center gap-3 py-2 text-center">
        <span aria-hidden className="grid size-16 place-items-center rounded-full bg-acento-suave text-acento">
          <Heart size={30} fill="currentColor" />
        </span>
        <p className="font-serifa text-[32px] text-texto">{nome}</p>
        <p className="tipo-corpo text-texto-mudo">{copy.match.texto(nome)}</p>
      </div>
      <div className="mt-4 flex gap-2">
        <Botao largura="total" variant="secundario" onClick={() => setAtual(null)}>
          {copy.match.fechar}
        </Botao>
        <Botao
          largura="total"
          onClick={() => {
            setAtual(null);
            router.push("/nomes/meus?aba=match");
          }}
        >
          {copy.match.ver}
        </Botao>
      </div>
    </Sheet>
  );
}
