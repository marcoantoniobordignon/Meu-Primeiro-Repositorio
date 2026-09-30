"use client";

import { ClipboardList, Footprints, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { SheetSintomas } from "@/components/features/sintomas/SheetSintomas";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Vazio } from "@/components/ui/Vazio";
import { sintomasCopy as copy } from "@/copy/sintomas";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { sessoesChutes, sintomas as colecao } from "@/lib/dados/colecoes";
import { formatarDuracao, paraISO, rotuloDia, type DataISO } from "@/lib/dates";
import { nomeDoSintoma } from "@/lib/sintomas/catalogo";
import { diaEditavel, forteTresDiasSeguidos, porDia } from "@/lib/sintomas/regras";

import { notaDoDia } from "@/components/features/sintomas/acoes";

/** Diário: lista por dia, filtro por sintoma, toque para editar (SIN-07, SIN-08). */
export default function PaginaDiario() {
  const todos = useColecao(colecao);
  const chutes = useColecao(sessoesChutes);
  const hoje = paraISO(new Date());
  const [filtro, setFiltro] = useState<string | null>(null);
  const [editando, setEditando] = useState<DataISO | null>(null);

  const slugsPresentes = useMemo(() => [...new Set(todos.map((s) => s.slug))].sort((a, b) => nomeDoSintoma(a).localeCompare(nomeDoSintoma(b))), [todos]);
  const filtrados = filtro ? todos.filter((s) => s.slug === filtro) : todos;
  const dias = porDia(filtrados);

  useEffect(() => {
    track("diario_visto", { dias_com_registro: porDia(colecao.listar()).length });
  }, []);

  const chutesDoDia = (data: DataISO) => chutes.filter((c) => c.fim && paraISO(new Date(c.inicio)) === data);

  return (
    <div>
      <Cabecalho
        titulo={copy.diario.titulo}
        voltarPara="/hoje"
        acao={
          <Link href="/hoje/diario/resumo" className="flex min-h-11 items-center gap-1.5 rounded-pilula px-3 text-[14px] font-medium text-primaria-texto">
            <ClipboardList size={18} aria-hidden />
            {copy.diario.resumo}
          </Link>
        }
      />

      {todos.length === 0 ? (
        <Vazio
          icone={<NotebookPen size={24} />}
          frase={copy.diario.vazio}
          acao={<Botao onClick={() => setEditando(hoje)}>{copy.diario.registrarHoje}</Botao>}
        />
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-2">
          <div className="scroll-x-sem-barra -mx-5 flex gap-2 px-5">
            <Chip selecionado={filtro === null} onToggle={() => setFiltro(null)}>
              {copy.diario.filtroTodos}
            </Chip>
            {slugsPresentes.map((slug) => (
              <Chip key={slug} selecionado={filtro === slug} onToggle={(v) => setFiltro(v ? slug : null)}>
                {nomeDoSintoma(slug)}
              </Chip>
            ))}
          </div>

          {dias.map(({ data, itens }) => {
            const editavel = diaEditavel(data, hoje);
            const nota = notaDoDia(itens);
            const valeComentar = itens.some((s) => forteTresDiasSeguidos(todos, s.slug, data));
            const sessoes = chutesDoDia(data);
            return (
              <button key={data} type="button" onClick={() => setEditando(data)} className="text-left" aria-label={`${rotuloDia(data, hoje)}${editavel ? "" : " (só leitura)"}`}>
                <Card>
                  <div className="flex items-baseline justify-between">
                    <p className="tipo-saudacao text-texto">{rotuloDia(data, hoje)}</p>
                    <p className="tipo-meta">{itens.length} {itens.length === 1 ? "sintoma" : "sintomas"}</p>
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {itens.map((s) => (
                      <li key={s.id} className="tipo-corpo flex items-center gap-1.5 text-texto">
                        <span aria-hidden className="flex gap-0.5">
                          {[1, 2, 3].map((n) => (
                            <span key={n} className={`size-1.5 rounded-full ${n <= s.intensidade ? "bg-acento" : "bg-fio"}`} />
                          ))}
                        </span>
                        {nomeDoSintoma(s.slug)}
                        <span className="tipo-meta">· {copy.diario.intensidade[s.intensidade]}</span>
                      </li>
                    ))}
                  </ul>
                  {sessoes.map((c) => (
                    <p key={c.id} className="tipo-meta mt-2 flex items-center gap-1.5">
                      <Footprints size={12} aria-hidden />
                      {c.total} chutes em {formatarDuracao((new Date(c.fim!).getTime() - new Date(c.inicio).getTime()) / 1000)}
                    </p>
                  ))}
                  {nota && <p className="tipo-voz mt-2 text-texto-mudo">“{nota}”</p>}
                  {valeComentar && <p className="tipo-meta mt-2 text-primaria-texto">{copy.diario.valeComentar}</p>}
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <SheetSintomas aberto={editando !== null} data={editando ?? hoje} onFechar={() => setEditando(null)} />
    </div>
  );
}
