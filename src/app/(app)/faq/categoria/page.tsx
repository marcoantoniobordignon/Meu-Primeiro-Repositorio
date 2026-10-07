"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LinhaVerbete } from "@/components/features/faq/LinhaVerbete";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { faqCopy as copy } from "@/copy/faq";
import { useFaq } from "@/lib/faq/useFaq";
import { CATEGORIAS_FAQ, type CategoriaFaq } from "@dominio/faq.ts";

function Conteudo() {
  const c = useSearchParams().get("c") as CategoriaFaq | null;
  const { verbetes } = useFaq();
  if (!c || !CATEGORIAS_FAQ.includes(c)) return <Cabecalho titulo={copy.titulo} voltarPara="/faq" />;
  const lista = verbetes.filter((v) => v.category === c).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return (
    <div>
      <Cabecalho titulo={copy.categoria[c]} voltarPara="/faq" />
      <ul className="divide-y divide-fio px-5 pb-8">{lista.map((v) => <LinhaVerbete key={v.id} v={v} />)}</ul>
    </div>
  );
}

/** Navegação por categoria. */
export default function PaginaCategoria() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
