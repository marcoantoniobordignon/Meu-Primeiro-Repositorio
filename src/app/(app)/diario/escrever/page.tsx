"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { EditorEntrada } from "@/components/features/diario/EditorEntrada";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { diarioCopy as copy } from "@/copy/diario";
import { useColecao } from "@/lib/dados/colecao";
import { diaryPhotos } from "@/lib/dados/colecoes";
import { useDiario } from "@/lib/diario/useDiario";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { marcoDoCatalogo, marcoVisivel } from "@dominio/diario.ts";

function Conteudo() {
  const params = useSearchParams();
  const { entradas, eu, modoFe, permissoes } = useDiario();
  const fotos = useColecao(diaryPhotos);
  useAberturaPorLembrete();
  const marcoPedido = marcoDoCatalogo(params.get("marco"));
  const marco = marcoPedido && marcoVisivel(marcoPedido, modoFe) ? marcoPedido : undefined;
  const id = params.get("id");
  // RN-02: reabrir o marco edita a entrada que já existe.
  const existente = id ? entradas.find((e) => e.id === id && e.criado_por === eu) : marco ? entradas.find((e) => e.milestone_code === marco.code && e.criado_por === eu) : undefined;
  const marcoFinal = existente ? marcoDoCatalogo(existente.milestone_code) : marco;
  if (!permissoes.verDiario) return null;
  return (
    <>
      <Cabecalho titulo={marcoFinal?.title ?? (existente ? copy.editar : copy.nova)} voltarPara={existente ? `/diario/${existente.id}` : "/diario"} />
      <EditorEntrada key={existente?.id ?? marcoFinal?.code ?? "livre"} marco={marcoFinal} existente={existente} fotosExistentes={existente ? fotos.filter((f) => f.entry_id === existente.id) : []} />
    </>
  );
}

/** Telas 2 (marco) e 3 (entrada livre). */
export default function PaginaEscrever() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
