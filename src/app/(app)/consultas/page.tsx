"use client";

import { CalendarDays, ClipboardList, MessageCircleQuestion, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useState } from "react";

import { CardComoFoi } from "@/components/features/consultas/CardComoFoi";
import { detalheDaConsulta, LinhaConsulta } from "@/components/features/consultas/LinhaConsulta";
import { Pauta } from "@/components/features/consultas/Pauta";
import { SheetConsulta } from "@/components/features/consultas/SheetConsulta";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Vazio } from "@/components/ui/Vazio";
import { consultasCopy as copy } from "@/copy/consultas";
import { consultaParaPerguntar, linhaDoTempo } from "@/lib/consultas";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentQuestions, appointments } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { pautaDaConsulta } from "@dominio/consultas.ts";

function Abertura() {
  useAberturaPorLembrete();
  return null;
}

/** Consultas: próxima em destaque, futuras e passadas; pauta mesmo sem consulta (critério de aceite). */
export default function PaginaConsultas() {
  const todas = useColecao(appointments);
  const perguntas = useColecao(appointmentQuestions);
  const { permissoes } = useFamilia();
  const tz = useFuso();
  const agora = useAgora(60_000);
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const { proxima, futuras, passadas } = linhaDoTempo(todas, agora, tz);
  const comoFoi = consultaParaPerguntar(todas, agora, tz);
  const pendentes = pautaDaConsulta(proxima, proxima, perguntas).length;

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <Suspense>
        <Abertura />
      </Suspense>
      <div className="flex flex-col gap-5 px-5 pt-1">
        {comoFoi && <CardComoFoi consulta={comoFoi} agora={agora} podeConcluir={permissoes.gerirConsultas} />}

        {todas.length === 0 ? (
          <>
            <Vazio icone={<CalendarDays size={24} />} frase={copy.vazio} acao={permissoes.gerirConsultas ? <Botao onClick={() => setNova(true)}>{copy.nova}</Botao> : undefined} />
            <section>
              <h2 className="tipo-titulo-secao mb-1 text-texto">{copy.pauta}</h2>
              <p className="tipo-meta mb-3">{copy.vazioApoio}</p>
              <Pauta />
            </section>
          </>
        ) : (
          <>
            {proxima && (
              <section>
                <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.proxima}</h2>
                <Card>
                  <Link href={`/consultas/${proxima.id}`} className="block min-h-11">
                    <span className="block text-[18px] font-medium text-texto">{formatarQuando(proxima.starts_at, agora)}</span>
                    <span className="tipo-meta block">{detalheDaConsulta(proxima)}</span>
                  </Link>
                  <div className="-mx-4 mt-2 divide-y divide-fio border-t border-fio">
                    <Link href="/consultas/pauta" className="flex min-h-12 items-center gap-3 px-4 text-[15px] text-texto">
                      <MessageCircleQuestion size={18} aria-hidden className="text-primaria-texto" />
                      <span className="flex-1">{copy.pauta}</span>
                      <span className="tipo-meta">{copy.perguntasNaPauta(pendentes)}</span>
                    </Link>
                    {permissoes.gerirConsultas && (
                      <Link href="/consultas/levar" className="flex min-h-12 items-center gap-3 px-4 text-[15px] text-texto">
                        <ClipboardList size={18} aria-hidden className="text-primaria-texto" />
                        {copy.levar}
                      </Link>
                    )}
                  </div>
                </Card>
              </section>
            )}
            {!proxima && (
              <section>
                <h2 className="tipo-titulo-secao mb-2 text-texto">{copy.pauta}</h2>
                <Pauta />
              </section>
            )}
            {futuras.length > 0 && (
              <section>
                <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.futuras}</h2>
                <ul className="flex flex-col gap-2">
                  {futuras.map((c) => (
                    <LinhaConsulta key={c.id} consulta={c} agora={agora} />
                  ))}
                </ul>
              </section>
            )}
            {passadas.length > 0 && (
              <section>
                <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.passadas}</h2>
                <ul className="flex flex-col gap-2">
                  {passadas.map((c) => (
                    <LinhaConsulta key={c.id} consulta={c} agora={agora} />
                  ))}
                </ul>
              </section>
            )}
            {permissoes.gerirConsultas && (
              <Botao largura="total" variant="secundario" icone={<Plus size={16} aria-hidden />} onClick={() => setNova(true)}>
                {copy.nova}
              </Botao>
            )}
            {!permissoes.gerirConsultas && proxima && (
              <Botao largura="total" variant="secundario" onClick={() => router.push("/consultas/pauta")}>
                {copy.novaPergunta}
              </Botao>
            )}
          </>
        )}
      </div>
      <SheetConsulta aberto={nova} onFechar={() => setNova(false)} />
    </div>
  );
}
