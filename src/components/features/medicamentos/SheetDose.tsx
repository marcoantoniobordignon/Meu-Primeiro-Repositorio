"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { track } from "@/lib/analytics";
import type { Medication, MedicationDose } from "@/lib/dados/colecoes";
import { adiarDose, pularDose, tomarDose } from "@/lib/medicamentos/acoes";
import { podeAdiar } from "@dominio/medicamentos.ts";
import { dataNoFuso, horaNoFuso, instanteLocal } from "@dominio/tempo.ts";

interface Props {
  dose: MedicationDose | null;
  med: Medication | undefined;
  tz: string;
  onFechar: () => void;
  /** De onde veio: o toque na notificação (iPhone) conta como "push". */
  origem?: "app" | "push";
}

/**
 * Sheet de confirmação (RN-06): horário real (agora, ou o programado em dose antiga),
 * "Tomei" e "Pular". Hoje e já no horário, "Adiar 15 min" até 2 vezes (RN-05).
 */
export function SheetDose({ dose, med, tz, onFechar, origem = "app" }: Props) {
  const [hora, setHora] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const { mostrar } = useToast();

  const agora = new Date();
  const dia = dose ? dataNoFuso(new Date(dose.scheduled_at ?? dose.taken_at ?? agora), tz) : dataNoFuso(agora, tz);
  const hoje = dataNoFuso(agora, tz);
  const retroativo = dia < hoje;

  useEffect(() => {
    if (!dose) return;
    setErro(undefined);
    if (dose.taken_at) setHora(horaNoFuso(new Date(dose.taken_at), tz));
    else if (retroativo && dose.scheduled_at) setHora(horaNoFuso(new Date(dose.scheduled_at), tz));
    else setHora(horaNoFuso(new Date(), tz));
    // Só ao abrir outra dose.
  }, [dose?.id]);

  if (!dose) return <Sheet aberto={false} onFechar={onFechar}>{null}</Sheet>;

  function tomar() {
    if (!dose) return;
    const quando = instanteLocal(dia, hora || horaNoFuso(new Date(), tz), tz);
    if (quando.getTime() > Date.now() + 60_000) {
      setErro(copy.horarioFuturo);
      return;
    }
    const source = retroativo ? "backfill" : origem;
    const { minutosAtraso } = tomarDose(dose, quando, source);
    track("med_dose_taken", { source, minutes_late: minutosAtraso });
    mostrar(copy.registrada);
    onFechar();
  }

  function pular() {
    if (!dose) return;
    pularDose(dose, retroativo ? "backfill" : origem);
    track("med_dose_skipped", {});
    mostrar(copy.pulada);
    onFechar();
  }

  function adiar() {
    if (!dose) return;
    const d = adiarDose(dose);
    track("med_dose_snoozed", {});
    mostrar(copy.adiada(horaNoFuso(new Date(d.snoozed_until!), tz)));
    onFechar();
  }

  const jaNoHorario = Boolean(dose.scheduled_at && new Date(dose.scheduled_at).getTime() <= agora.getTime());
  const mostraAdiar = !retroativo && jaNoHorario && podeAdiar(dose);

  return (
    <Sheet
      aberto
      onFechar={onFechar}
      titulo={med?.name ?? copy.sheetTitulo}
      rodape={
        <div className="flex flex-col gap-2">
          <Botao largura="total" tamanho="lg" onClick={tomar}>
            {copy.tomei}
          </Botao>
          <div className="flex gap-2">
            <Botao largura="total" variant="secundario" onClick={pular}>
              {copy.pular}
            </Botao>
            {mostraAdiar && (
              <Botao largura="total" variant="secundario" onClick={adiar}>
                {copy.adiar}
              </Botao>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {(med?.dose || med?.instructions) && <p className="tipo-corpo text-texto-mudo">{[med.dose, med.instructions].filter(Boolean).join(" · ")}</p>}
        <CampoTexto rotulo={copy.horarioReal} type="time" value={hora} onChange={(e) => setHora(e.target.value)} erro={erro} />
      </div>
    </Sheet>
  );
}
