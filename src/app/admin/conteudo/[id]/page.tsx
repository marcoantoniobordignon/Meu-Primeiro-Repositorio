"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import { EditorConteudo } from "@/components/admin/EditorConteudo";
import { Erro, EsqueletoLinhas } from "@/components/admin/Estado";
import { Titulo } from "@/components/admin/Titulo";
import { Botao } from "@/components/ui/Botao";
import { adminCopy as copy } from "@/copy/admin";
import { useDados } from "@/lib/admin/fonte";

const ed = copy.conteudo.editor;

export default function PaginaEditarConteudo() {
  const { id } = useParams<{ id: string }>();
  const existentes = useDados((f) => f.conteudos());
  const atual = existentes.dados?.find((c) => c.id === id);

  return (
    <div>
      <Titulo titulo={ed.editarTitulo} apoio={atual?.titulo} />
      {existentes.erro ? (
        <Erro mensagem={existentes.erro} onTentar={existentes.recarregar} />
      ) : !existentes.dados ? (
        <EsqueletoLinhas linhas={8} />
      ) : !atual ? (
        <div className="flex flex-col items-start gap-3">
          <p className="tipo-corpo text-texto-mudo">{ed.naoEncontrado}</p>
          <Link href="/admin/conteudo">
            <Botao variant="secundario">{ed.voltar}</Botao>
          </Link>
        </div>
      ) : (
        <EditorConteudo key={atual.id} inicial={atual} novo={false} slugsExistentes={existentes.dados.filter((c) => c.id !== atual.id).map((c) => c.slug)} />
      )}
    </div>
  );
}
