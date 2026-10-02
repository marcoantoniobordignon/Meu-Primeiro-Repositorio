"use client";

import { EditorConteudo } from "@/components/admin/EditorConteudo";
import { Erro, EsqueletoLinhas } from "@/components/admin/Estado";
import { Titulo } from "@/components/admin/Titulo";
import { adminCopy as copy } from "@/copy/admin";
import { novoConteudo } from "@/lib/admin/conteudo";
import { useDados } from "@/lib/admin/fonte";

export default function PaginaNovoConteudo() {
  const existentes = useDados((f) => f.conteudos());
  return (
    <div>
      <Titulo titulo={copy.conteudo.editor.novoTitulo} />
      {existentes.erro ? (
        <Erro mensagem={existentes.erro} onTentar={existentes.recarregar} />
      ) : existentes.dados ? (
        <EditorConteudo inicial={novoConteudo()} novo slugsExistentes={existentes.dados.map((c) => c.slug)} />
      ) : (
        <EsqueletoLinhas linhas={8} />
      )}
    </div>
  );
}
