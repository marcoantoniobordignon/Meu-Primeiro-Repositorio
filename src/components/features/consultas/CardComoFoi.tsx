"use client";

import { useRouter } from "next/navigation";

import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { tiposConsulta } from "@/lib/consultas";
import { cancelarConsulta, dispensarComoFoi } from "@/lib/consultas-acoes";
import type { Appointment } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";

/** RN-07: "Como foi a consulta?" no dia seguinte, uma vez por consulta. */
export function CardComoFoi({ consulta, agora, podeConcluir }: { consulta: Appointment; agora: Date; podeConcluir: boolean }) {
  const router = useRouter();
  const { mostrar } = useToast();
  return (
    <section className="rounded-card border-2 border-acento bg-superficie px-4 py-3.5">
      <p className="tipo-saudacao text-texto">{copy.comoFoi}</p>
      <p className="tipo-meta mt-0.5">
        {tiposConsulta[consulta.kind]} · {formatarQuando(consulta.starts_at, agora)}
      </p>
      <p className="tipo-corpo mt-2 text-texto-mudo">{copy.comoFoiApoio}</p>
      <div className="mt-3 flex flex-col gap-2">
        {podeConcluir && (
          <Botao largura="total" onClick={() => router.push(`/consultas/${consulta.id}/concluir`)}>
            {copy.contar}
          </Botao>
        )}
        <div className="flex gap-2">
          {podeConcluir && (
            <Botao
              largura="total"
              variant="secundario"
              onClick={() => {
                cancelarConsulta(consulta);
                track("appt_cancelled", {});
                mostrar(copy.cancelada);
              }}
            >
              {copy.foiCancelada}
            </Botao>
          )}
          <Botao largura="total" variant="fantasma" onClick={() => dispensarComoFoi(consulta)}>
            {copy.dispensar}
          </Botao>
        </div>
      </div>
    </section>
  );
}
