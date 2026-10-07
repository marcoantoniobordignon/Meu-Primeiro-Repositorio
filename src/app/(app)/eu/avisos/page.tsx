"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Vazio } from "@/components/ui/Vazio";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { useColecao } from "@/lib/dados/colecao";
import { avisos } from "@/lib/dados/colecoes";
import { haQuantoTempo } from "@/lib/dates";
import { meuId } from "@/lib/familia/useFamilia";

/** Central de avisos (sem push): o que aconteceu enquanto ela não olhava. Abrir marca como lido. */
export default function PaginaAvisos() {
  const eu = meuId();
  const lista = useColecao(avisos)
    .filter((a) => a.para === eu)
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em));

  useEffect(() => {
    const agora = new Date().toISOString();
    for (const a of avisos.listar()) if (a.para === eu && !a.lido_em) avisos.salvar({ ...a, lido_em: agora });
  }, [eu]);

  return (
    <div>
      <Cabecalho titulo={copy.centralTitulo} voltarPara="/eu" />
      {lista.length === 0 ? (
        <Vazio icone={<Bell size={24} />} frase={copy.centralVazia} />
      ) : (
        <ul className="flex flex-col gap-2 px-5 pt-1">
          {lista.map((a) => {
            const corpo = (
              <Card>
                <p className="text-[15px] font-medium text-texto">{a.titulo}</p>
                {a.corpo && <p className="tipo-corpo mt-0.5 text-texto-mudo">{a.corpo}</p>}
                <p className="tipo-meta mt-1">{haQuantoTempo(a.criado_em)}</p>
              </Card>
            );
            return <li key={a.id}>{a.url ? <Link href={a.url}>{corpo}</Link> : corpo}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
