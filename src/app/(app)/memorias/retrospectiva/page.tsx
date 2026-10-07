"use client";

import { BookHeart } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { PlayerRetrospectiva } from "@/components/features/retrospectiva/Player";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Vazio } from "@/components/ui/Vazio";
import { retroCopy as copy } from "@/copy/retrospectiva";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useRetrospectiva, useRetrospectivasDisponiveis } from "@/lib/retrospectiva/useRetrospectiva";
import type { TipoRetro } from "@dominio/retrospectiva.ts";

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { tipos } = useRetrospectivasDisponiveis();
  const pedido = params.get("kind");
  const kind: TipoRetro = pedido === "preview" || pedido === "final" ? pedido : (tipos[0] ?? "preview");
  const r = useRetrospectiva(kind);
  const { papel } = useFamilia();

  if (!r.perfil) return null;
  // Critério: o parceiro não vê a retrospectiva (só o vídeo que ela compartilhar).
  if (papel !== "mae" || !r.disponivel)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/memorias" />
        <Vazio
          icone={<BookHeart size={24} />}
          frase={papel !== "mae" ? copy.player.soGestante : copy.player.indisponivel}
          acao={
            <Link href="/memorias" className="tipo-titulo-secao text-primaria-texto">
              {copy.player.voltar}
            </Link>
          }
        />
      </div>
    );

  return <PlayerRetrospectiva kind={kind} slides={r.slides} ponteHref="/hoje" onFechar={() => router.push("/memorias")} />;
}

/** Tela 3 · player de stories (`?kind=preview|final`). */
export default function PaginaRetrospectiva() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
