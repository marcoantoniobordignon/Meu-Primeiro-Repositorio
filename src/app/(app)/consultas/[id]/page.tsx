"use client";

import { Check, ClipboardList, Pencil } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { detalheDaConsulta } from "@/components/features/consultas/LinhaConsulta";
import { Pauta } from "@/components/features/consultas/Pauta";
import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { consultasCopy as copy } from "@/copy/consultas";
import { resumoMedidas, temMedidas } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentMeasures, appointmentQuestions, appointments } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";

/** Uma consulta: marcada mostra a pauta; feita mostra medidas (só a gestante), orientações e respostas. */
export default function PaginaConsulta() {
  const { id } = useParams<{ id: string }>();
  const todas = useColecao(appointments);
  const medidas = useColecao(appointmentMeasures);
  const perguntas = useColecao(appointmentQuestions);
  const { permissoes } = useFamilia();
  const agora = useAgora(60_000);
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const c = todas.find((x) => x.id === id);
  if (!c) return <Cabecalho titulo={copy.titulo} voltarPara="/consultas" />;
  const m = permissoes.verMedidas ? medidas.find((x) => x.appointment_id === c.id) : undefined;
  const feitas = perguntas.filter((p) => p.appointment_id === c.id && p.was_asked);

  return (
    <div>
      <Cabecalho
        titulo={formatarQuando(c.starts_at, agora)}
        voltarPara="/consultas"
        acao={
          permissoes.gerirConsultas ? (
            <button type="button" aria-label={copy.editar} onClick={() => setEditando(true)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
              <Pencil size={18} />
            </button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-5 px-5 pt-1">
        <Card>
          <p className="tipo-corpo text-texto">{detalheDaConsulta(c)}</p>
          <p className="tipo-meta mt-1">{copy.status[c.status]}</p>
        </Card>

        {c.status === "scheduled" && (
          <>
            <section>
              <h2 className="tipo-titulo-secao mb-2 text-texto">{copy.pauta}</h2>
              <Pauta consulta={c} />
            </section>
            {permissoes.gerirConsultas && (
              <div className="flex flex-col gap-2">
                <Botao largura="total" tamanho="lg" onClick={() => router.push(`/consultas/${c.id}/concluir`)}>
                  {copy.concluir}
                </Botao>
                <Link href="/consultas/levar" className="flex min-h-11 items-center justify-center gap-2 text-[14px] font-medium text-primaria-texto">
                  <ClipboardList size={16} aria-hidden />
                  {copy.levar}
                </Link>
              </div>
            )}
          </>
        )}

        {c.status === "done" && (
          <>
            {m && temMedidas(m) && (
              <Card>
                <h2 className="tipo-titulo-secao text-texto-mudo">{copy.medidas}</h2>
                <p className="tipo-corpo mt-1 text-texto">{resumoMedidas(m)}</p>
              </Card>
            )}
            {m?.notes_after && (
              <Card>
                <h2 className="tipo-titulo-secao text-texto-mudo">{copy.orientacoes}</h2>
                <p className="tipo-corpo mt-1 whitespace-pre-line text-texto">{m.notes_after}</p>
              </Card>
            )}
            {feitas.length > 0 && (
              <section>
                <h2 className="tipo-titulo-secao mb-2 text-texto">{copy.perguntas}</h2>
                <ul className="flex flex-col gap-2">
                  {feitas.map((p) => (
                    <li key={p.id} className="flex gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                      <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-sucesso" />
                      <span>
                        <span className="tipo-corpo block text-texto">{p.text}</span>
                        {p.answer && <span className="tipo-meta block">{p.answer}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
      <SheetConsulta aberto={editando} consulta={c} onFechar={() => setEditando(false)} />
    </div>
  );
}
