"use client";

import { Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LinhaItem } from "@/components/features/calendario/LinhaItem";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { calendarioCopy as copy } from "@/copy/calendario";
import { useCalendario } from "@/lib/calendario/useCalendario";
import { formatarLonga } from "@/lib/dates";
import { itensDoDia, rotuloGestacional } from "@dominio/calendario.ts";
import { dataISOValida } from "@dominio/tempo.ts";

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { perfil, itens, hoje, dpp, podeCriar } = useCalendario();
  const pedido = params.get("d") ?? "";
  const data = dataISOValida(pedido) ? pedido : hoje;
  if (!perfil) return null;
  const doDia = itensDoDia(itens, data);
  const g = rotuloGestacional(dpp, data);
  return (
    <div>
      <Cabecalho titulo={formatarLonga(data)} voltarPara="/calendario" />
      <div className="flex flex-col gap-3 px-5 pb-8 pt-1">
        {g && <p className="tipo-meta">{data === hoje ? copy.hojeCabecalho(g) : g}</p>}
        {doDia.length ? <ul className="flex flex-col">{doDia.map((i) => <LinhaItem key={`${i.tipo}-${i.id}`} item={i} />)}</ul> : <p className="tipo-corpo text-texto-mudo">{copy.semItens}</p>}
        {podeCriar && (
          <Botao variant="secundario" largura="total" icone={<Plus size={18} aria-hidden />} onClick={() => router.push(`/calendario/evento?data=${data}`)}>
            {copy.adicionarEvento}
          </Botao>
        )}
      </div>
    </div>
  );
}

/** Tela 3 "Dia": itens do dia; cada um abre a tela de origem (RN-03). */
export default function PaginaDia() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
