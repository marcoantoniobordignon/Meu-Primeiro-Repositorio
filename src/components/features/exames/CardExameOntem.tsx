"use client";

import { FlaskConical } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { examesCopy as copy } from "@/copy/exames";
import { useColecao } from "@/lib/dados/colecao";
import { userExams, type UserExam } from "@/lib/dados/colecoes";
import { formatarQuando } from "@/lib/dates";
import { desmarcarExame } from "@/lib/exames/acoes";
import { exameParaPerguntar } from "@/lib/exames/regras";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { nomeDoExame } from "@dominio/exames.ts";

import { SheetConcluirExame } from "./SheetConcluirExame";
import { SheetMarcarExame } from "./SheetMarcarExame";

/** RN-11: marcado cuja data passou sem ação vira o card "Seu exame foi ontem?" com "Já fiz" e "Remarquei". */
export function CardExameOntem() {
  const exames = useColecao(userExams);
  const tz = useFuso();
  const agora = useAgora(60_000);
  const [concluindo, setConcluindo] = useState<UserExam | null>(null);
  const [remarcando, setRemarcando] = useState<UserExam | null>(null);
  const e = exameParaPerguntar(exames, agora, tz);

  return (
    <>
      {e && (
        <section className="rounded-card border-2 border-acento bg-superficie px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-acento-suave text-texto">
              <FlaskConical size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="tipo-saudacao text-texto">{copy.foiOntem}</p>
              <p className="tipo-meta mt-0.5">{copy.foiEm(nomeDoExame(e), formatarQuando(e.scheduled_at!, agora))}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Botao largura="total" onClick={() => setConcluindo(e)}>
              {copy.jaFiz}
            </Botao>
            <Botao
              largura="total"
              variant="secundario"
              onClick={() => {
                setRemarcando(desmarcarExame(e));
              }}
            >
              {copy.remarquei}
            </Botao>
          </div>
        </section>
      )}
      <SheetConcluirExame exame={concluindo} tz={tz} onFechar={() => setConcluindo(null)} />
      <SheetMarcarExame exame={remarcando} tz={tz} onFechar={() => setRemarcando(null)} />
    </>
  );
}
