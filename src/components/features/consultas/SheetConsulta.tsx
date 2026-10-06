"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Escolha } from "@/components/ui/Escolha";
import { Sheet } from "@/components/ui/Sheet";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { papeisProfissional, tiposConsulta } from "@/lib/consultas";
import { cancelarConsulta, excluirConsulta, salvarConsulta } from "@/lib/consultas-acoes";
import type { Appointment, AppointmentKind, ProviderRole } from "@/lib/dados/colecoes";
import { useFuso } from "@/lib/hooks/useFuso";
import { dataNoFuso, horaNoFuso, instanteLocal, type DataISO } from "@dominio/tempo.ts";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  consulta?: Appointment | null;
  /** RN-05: aceitar a sugestão de retorno abre o formulário com a data preenchida. */
  dataSugerida?: DataISO | null;
}

const KINDS = Object.keys(tiposConsulta) as AppointmentKind[];
const PAPEIS = Object.keys(papeisProfissional) as ProviderRole[];

/** Nova consulta ou editar: data e hora, tipo, profissional, papel e local (RN-01). */
export function SheetConsulta({ aberto, onFechar, consulta, dataSugerida }: Props) {
  const tz = useFuso();
  const [data, setData] = useState("");
  const [hora, setHora] = useState("");
  const [kind, setKind] = useState<AppointmentKind>("prenatal");
  const [nome, setNome] = useState("");
  const [papel, setPapel] = useState<ProviderRole | null>(null);
  const [local, setLocal] = useState("");
  const [tocou, setTocou] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    const quando = consulta ? new Date(consulta.starts_at) : null;
    setData(quando ? dataNoFuso(quando, tz) : (dataSugerida ?? ""));
    setHora(quando ? horaNoFuso(quando, tz) : "09:00");
    setKind(consulta?.kind ?? "prenatal");
    setNome(consulta?.provider_name ?? "");
    setPapel(consulta?.provider_role ?? null);
    setLocal(consulta?.location ?? "");
    setTocou(false);
  }, [aberto, consulta, dataSugerida, tz]);

  const valido = Boolean(data && hora);

  function salvar() {
    setTocou(true);
    if (!valido) return;
    const salva = salvarConsulta(
      {
        starts_at: instanteLocal(data, hora, tz).toISOString(),
        kind,
        provider_name: nome.trim().slice(0, 80) || null,
        provider_role: papel,
        location: local.trim().slice(0, 120) || null,
      },
      consulta,
    );
    if (!consulta) track("appt_created", { kind, source: dataSugerida ? "suggestion" : "manual" });
    mostrar(!consulta && salva.status === "done" ? copy.salvaPassada : copy.salva);
    onFechar();
  }

  return (
    <>
      <Sheet
        aberto={aberto}
        onFechar={onFechar}
        titulo={consulta ? copy.editar : copy.nova}
        rodape={
          <div className="flex flex-col gap-2">
            <Botao largura="total" tamanho="lg" onClick={salvar}>
              {copy.salvar}
            </Botao>
            {consulta && (
              <div className="flex gap-2">
                {consulta.status === "scheduled" && (
                  <Botao
                    largura="total"
                    variant="secundario"
                    onClick={() => {
                      cancelarConsulta(consulta);
                      track("appt_cancelled", {});
                      mostrar(copy.cancelada);
                      onFechar();
                    }}
                  >
                    {copy.cancelar}
                  </Botao>
                )}
                <Botao largura="total" variant="fantasma" onClick={() => setExcluindo(true)}>
                  {copy.excluir}
                </Botao>
              </div>
            )}
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-[1fr_120px] gap-3">
            <CampoTexto rotulo={copy.data} type="date" value={data} onChange={(e) => setData(e.target.value)} erro={tocou && !valido ? copy.erroData : undefined} />
            <CampoTexto rotulo={copy.hora} type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
          </div>
          <Escolha rotulo={copy.tipo} opcoes={KINDS.map((k) => ({ valor: k, rotulo: tiposConsulta[k] }))} valor={kind} onMudar={setKind} />
          <CampoTexto rotulo={copy.profissional} value={nome} maxLength={80} onChange={(e) => setNome(e.target.value)} autoComplete="off" />
          <Escolha rotulo={copy.papel} opcoes={PAPEIS.map((p) => ({ valor: p, rotulo: papeisProfissional[p] }))} valor={papel ?? ("" as ProviderRole)} onMudar={(p) => setPapel((atual) => (atual === p ? null : p))} />
          <CampoTexto rotulo={copy.local} value={local} maxLength={120} onChange={(e) => setLocal(e.target.value)} autoComplete="off" />
        </div>
      </Sheet>
      <SheetConfirmar
        aberto={excluindo}
        titulo={copy.excluir}
        texto={copy.excluirConfirma}
        confirmar={copy.excluir}
        cancelar={copy.voltar}
        onFechar={() => setExcluindo(false)}
        onConfirmar={() => {
          if (!consulta) return;
          excluirConsulta(consulta);
          mostrar(copy.excluida);
          onFechar();
        }}
      />
    </>
  );
}
