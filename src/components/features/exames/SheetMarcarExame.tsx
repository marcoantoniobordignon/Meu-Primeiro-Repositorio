"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Faixa } from "@/components/ui/Faixa";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { examesCopy as copy } from "@/copy/exames";
import { track } from "@/lib/analytics";
import type { UserExam } from "@/lib/dados/colecoes";
import { marcarExame } from "@/lib/exames/acoes";
import { foraDaJanela, validarMarcacao } from "@/lib/exames/regras";
import { diasAteFimDaJanela, nomeDoExame } from "@dominio/exames.ts";
import { dataNoFuso, horaNoFuso } from "@dominio/tempo.ts";

interface Props {
  exame: UserExam | null;
  tz: string;
  onFechar: () => void;
}

/** RN-06: data obrigatória, hora opcional; fora da janela avisa; passado não. */
export function SheetMarcarExame({ exame, tz, onFechar }: Props) {
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [local, setLocal] = useState("");
  const [notas, setNotas] = useState("");
  const [tocou, setTocou] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!exame) return;
    const marcado = exame.scheduled_at ? new Date(exame.scheduled_at) : null;
    setData(marcado ? dataNoFuso(marcado, tz) : "");
    setHora(marcado && !exame.scheduled_all_day ? horaNoFuso(marcado, tz) : "");
    setLocal(exame.location ?? "");
    setNotas(exame.notes ?? "");
    setTocou(false);
  }, [exame, tz]);

  const erro = validarMarcacao({ data, hora }, new Date(), tz);
  const aviso = exame && data && !erro && foraDaJanela(exame, data);

  function salvar() {
    setTocou(true);
    if (!exame || erro) return;
    marcarExame(exame, { data, hora }, tz, { location: local.trim().slice(0, 80) || null, notes: notas.trim().slice(0, 300) || null });
    track("exam_scheduled", { code: exame.catalog_code ?? "custom", days_to_window_end: diasAteFimDaJanela(exame, data) });
    mostrar(copy.marcado);
    onFechar();
  }

  return (
    <Sheet
      aberto={Boolean(exame)}
      onFechar={onFechar}
      titulo={exame ? nomeDoExame(exame) : copy.sheetMarcar}
      rodape={
        <Botao largura="total" tamanho="lg" onClick={salvar}>
          {copy.salvar}
        </Botao>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <CampoTexto
            rotulo={copy.data}
            type="date"
            value={data}
            min={dataNoFuso(new Date(), tz)}
            onChange={(e) => setData(e.target.value)}
            erro={tocou && erro ? (erro === "sem_data" ? copy.erroSemData : copy.erroPassado) : undefined}
          />
          <CampoTexto rotulo={copy.hora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
        {aviso && <Faixa tom="alerta">{copy.foraDaJanela}</Faixa>}
        <CampoTexto rotulo={copy.local} value={local} maxLength={80} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />
        <CampoTexto rotulo={copy.observacao} value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} autoComplete="off" />
      </div>
    </Sheet>
  );
}
