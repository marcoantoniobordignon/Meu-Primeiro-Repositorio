"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CalendarioConteudo } from "@/components/admin/CalendarioConteudo";
import { Erro, EsqueletoLinhas } from "@/components/admin/Estado";
import { ListaConteudo } from "@/components/admin/ListaConteudo";
import { Segmentado } from "@/components/admin/Segmentado";
import { Titulo } from "@/components/admin/Titulo";
import { Botao } from "@/components/ui/Botao";
import { adminCopy as copy } from "@/copy/admin";
import { useDados } from "@/lib/admin/fonte";

const c = copy.conteudo;

export default function PaginaConteudo() {
  const [aba, setAba] = useState<"lista" | "calendario">("lista");
  const conteudos = useDados((f) => f.conteudos());
  const leituras = useDados((f) => f.leituras());
  const lista = conteudos.dados ?? [];
  const publicados = lista.filter((x) => x.publicado).length;

  return (
    <div>
      <Titulo
        titulo={c.titulo}
        apoio={conteudos.dados ? c.total(lista.length, publicados) : c.apoio}
        acao={
          <Link href="/admin/conteudo/novo">
            <Botao icone={<Plus size={16} aria-hidden />}>{c.novo}</Botao>
          </Link>
        }
      />
      <div className="mb-4">
        <Segmentado
          rotulo="Visão"
          valor={aba}
          onMudar={setAba}
          opcoes={[
            { valor: "lista", rotulo: c.abas.lista },
            { valor: "calendario", rotulo: c.abas.calendario },
          ]}
        />
      </div>
      {conteudos.erro ? (
        <Erro mensagem={conteudos.erro} onTentar={conteudos.recarregar} />
      ) : !conteudos.dados ? (
        <div className="rounded-card bg-superficie px-4 py-3">
          <EsqueletoLinhas linhas={10} />
        </div>
      ) : aba === "lista" ? (
        <ListaConteudo conteudos={lista} leituras={leituras.dados ?? []} />
      ) : (
        <CalendarioConteudo conteudos={lista} />
      )}
    </div>
  );
}
