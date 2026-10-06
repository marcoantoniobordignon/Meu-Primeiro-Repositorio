"use client";

import { Flame } from "lucide-react";
import { useEffect } from "react";

import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { medicationDoses } from "@/lib/dados/colecoes";
import { rotuloDia } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { adesao, adesaoPorDia, sequencia } from "@/lib/medicamentos/regras";

function Barras({ dias, rotulo }: { dias: ReturnType<typeof adesaoPorDia>; rotulo: string }) {
  return (
    <div role="img" aria-label={rotulo} className="flex h-24 items-end gap-[3px]">
      {dias.map((d) => (
        <span key={d.data} className="flex h-full flex-1 items-end rounded-[3px] bg-fio" title={`${d.data}: ${d.taxa === null ? "—" : Math.round(d.taxa * 100) + "%"}`}>
          <span className="w-full rounded-[3px] bg-primaria" style={{ height: `${Math.round((d.taxa ?? 0) * 100)}%` }} />
        </span>
      ))}
    </div>
  );
}

/** Adesão de 7 e 30 dias (RN-09) e sequência atual (RN-10). */
export default function PaginaAdesao() {
  const doses = useColecao(medicationDoses);
  const tz = useFuso();
  const agora = useAgora(60_000);

  useEffect(() => {
    track("med_adherence_viewed", {});
  }, []);

  const s = sequencia(doses, agora, tz);
  const bloco = (dias: number, titulo: string) => {
    const a = adesao(doses, agora, tz, dias);
    const barras = adesaoPorDia(doses, agora, tz, dias);
    const pct = a.taxa === null ? null : Math.round(a.taxa * 100);
    return (
      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="tipo-titulo-secao text-texto">{titulo}</h2>
          <p className="text-[28px] font-light text-texto">{pct === null ? "—" : `${pct}%`}</p>
        </div>
        {a.taxa === null ? (
          <p className="tipo-meta mt-1">{copy.semDados}</p>
        ) : (
          <>
            <p className="tipo-meta mt-1">{copy.legendaAdesao(a.tomadas, a.puladas, a.semRegistro)}</p>
            <div className="mt-3">
              <Barras dias={barras} rotulo={barras.map((b) => `${rotuloDia(b.data)}: ${b.taxa === null ? "sem doses" : `${Math.round(b.taxa * 100)}%`}`).join("; ")} />
            </div>
          </>
        )}
      </Card>
    );
  };

  return (
    <div>
      <Cabecalho titulo={copy.adesao} voltarPara="/medicamentos" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <Card tom="suave">
          <div className="flex items-center gap-3">
            <Flame size={20} aria-hidden className="text-primaria-texto" />
            <p className="tipo-corpo text-primaria-texto">{s > 0 ? copy.sequencia(s) : copy.sequenciaZero}</p>
          </div>
        </Card>
        {bloco(7, copy.ultimos7)}
        {bloco(30, copy.ultimos30)}
      </div>
    </div>
  );
}
