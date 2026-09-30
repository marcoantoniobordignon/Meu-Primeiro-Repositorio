"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { adminCopy as copy } from "@/copy/admin";
import { DIAS_DA_SEMANA, textoFaixa } from "@/lib/admin/conteudo";
import type { Leitura } from "@/lib/admin/tipos";
import type { Conteudo } from "@/lib/conteudo/banco";

import { Segmentado } from "./Segmentado";
import { Tabela, type Coluna } from "./Tabela";

interface Props {
  conteudos: Conteudo[];
  leituras: Leitura[];
}

type Filtro = "todos" | "publicados" | "rascunhos" | "premium";

const pontoCor: Record<string, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sono: "bg-sono",
  mamada: "bg-mamada",
};

/** Lista de todos os conteúdos com busca, filtro e leituras; clicar abre o editor. */
export function ListaConteudo({ conteudos, leituras }: Props) {
  const router = useRouter();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const porId = useMemo(() => new Map(leituras.map((l) => [l.conteudo_id, l])), [leituras]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return conteudos
      .filter((c) => (filtro === "publicados" ? c.publicado : filtro === "rascunhos" ? !c.publicado : filtro === "premium" ? c.premium : true))
      .filter((c) => !termo || c.titulo.toLowerCase().includes(termo) || c.slug.includes(termo))
      .sort((a, b) => (a.categoria === "semana" ? 1 : 0) - (b.categoria === "semana" ? 1 : 0) || a.titulo.localeCompare(b.titulo, "pt-BR", { numeric: true }));
  }, [conteudos, busca, filtro]);

  const col = copy.conteudo.colunas;
  const colunas: Coluna<Conteudo>[] = [
    {
      chave: "titulo",
      titulo: col.titulo,
      render: (c) => (
        <span className="flex items-center gap-2">
          <span aria-hidden className={`size-2.5 shrink-0 rounded-full ${pontoCor[c.cor_token]}`} />
          <span className="font-medium">{c.titulo}</span>
          {c.premium && <span className="rounded-pilula bg-acento-suave px-1.5 text-[10px] font-medium text-texto">{copy.conteudo.premium}</span>}
        </span>
      ),
    },
    { chave: "categoria", titulo: col.categoria, render: (c) => <span className="text-texto-mudo">{copy.conteudo.categoriaNome[c.categoria]}</span> },
    { chave: "faixa", titulo: col.faixa, render: (c) => <span className="text-texto-mudo">{textoFaixa(c)}</span> },
    { chave: "dia", titulo: col.dia, render: (c) => <span className="text-texto-mudo">{c.dia_da_semana === null ? copy.conteudo.qualquerDia : DIAS_DA_SEMANA[c.dia_da_semana]}</span> },
    { chave: "leituras", titulo: col.leituras, alinhar: "dir", render: (c) => porId.get(c.id)?.leituras ?? 0 },
    { chave: "guardados", titulo: col.guardados, alinhar: "dir", render: (c) => porId.get(c.id)?.guardados ?? 0 },
    {
      chave: "estado",
      titulo: col.estado,
      render: (c) => (
        <span className={`inline-flex items-center gap-1.5 text-[12px] ${c.publicado ? "text-sucesso" : "text-texto-mudo"}`}>
          <span aria-hidden className={`size-1.5 rounded-full ${c.publicado ? "bg-sucesso" : "bg-texto-mudo"}`} />
          {c.publicado ? copy.conteudo.publicado : copy.conteudo.rascunho}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 basis-56">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-texto-mudo" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={copy.conteudo.busca}
            aria-label={copy.conteudo.busca}
            className="block min-h-11 w-full rounded-pilula border border-fio bg-superficie pl-10 pr-4 text-[14px] text-texto placeholder:text-texto-mudo/70 focus:outline-none focus:ring-2 focus:ring-primaria"
          />
        </label>
        <Segmentado
          rotulo="Filtro"
          valor={filtro}
          onMudar={setFiltro}
          opcoes={[
            { valor: "todos", rotulo: copy.conteudo.filtros.todos },
            { valor: "publicados", rotulo: copy.conteudo.filtros.publicados },
            { valor: "rascunhos", rotulo: copy.conteudo.filtros.rascunhos },
            { valor: "premium", rotulo: copy.conteudo.filtros.premium },
          ]}
        />
      </div>
      <div className="rounded-card bg-superficie px-4 py-2">
        <Tabela colunas={colunas} linhas={lista} chave={(c) => c.id} vazio={copy.conteudo.vazio} onLinha={(c) => router.push(`/admin/conteudo/${c.id}`)} />
      </div>
    </div>
  );
}
