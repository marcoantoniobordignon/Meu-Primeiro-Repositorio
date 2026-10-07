"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { FormDocumento } from "@/components/features/galeria/FormDocumento";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { galeriaCopy as copy } from "@/copy/galeria";
import { useGaleria } from "@/lib/galeria/useGaleria";
import { ehTipo } from "@dominio/galeria.ts";

function Conteudo() {
  const params = useSearchParams();
  const { docs, perfil, podeEditar } = useGaleria();
  const id = params.get("id");
  const existente = id ? docs.find((d) => d.id === id) : undefined;
  const tipo = params.get("tipo");
  if (!perfil) return null;
  if (!podeEditar || (id && !existente)) return <Cabecalho titulo={copy.titulo} voltarPara="/galeria" />;
  return (
    <>
      <Cabecalho titulo={existente ? copy.editar : copy.novo} voltarPara={existente ? `/galeria/${existente.id}` : "/galeria"} />
      <FormDocumento key={existente?.id ?? "novo"} existente={existente} exameId={params.get("exame")} tipoInicial={ehTipo(tipo) ? tipo : null} />
    </>
  );
}

/** Tela 2 "Adicionar" (e editar, com `?id=`). Da spec 03 chega com `?exame=` e `?tipo=`. */
export default function PaginaAdicionarDocumento() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
