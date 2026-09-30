"use client";

import { useMemo, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { onboarding as copy } from "@/copy/onboarding";
import {
  diasEntre,
  dppDaDum,
  dppNoPassado,
  ehISOValida,
  formatarLonga,
  paraISO,
  somarDias,
} from "@/lib/dates";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

type ModoData = "dpp" | "dum";

/** Tela 2: DPP ou DUM (com cálculo inline), ou data de nascimento em modo bebê. */
export function TelaData({ estado, avancar, atualizar }: PropsTela) {
  const hoje = paraISO(new Date());
  const modoBebe = estado.momento === "bebe";

  const [modo, setModo] = useState<ModoData>(estado.dum ? "dum" : "dpp");
  const [dpp, setDpp] = useState(estado.dpp ?? "");
  const [dum, setDum] = useState(estado.dum ?? "");
  const [nascimento, setNascimento] = useState(estado.nascidoEm ?? "");
  const [ajustando, setAjustando] = useState(false);
  const [confirmarNascido, setConfirmarNascido] = useState(false);
  const [tocou, setTocou] = useState(false);

  const dppCalculada = useMemo(() => (modo === "dum" && ehISOValida(dum) ? dppDaDum(dum) : ""), [modo, dum]);
  const dppFinal = modo === "dum" && !ajustando ? dppCalculada : dpp;

  const erro = useMemo(() => {
    if (modoBebe) {
      if (!nascimento) return "";
      if (!ehISOValida(nascimento)) return copy.data.erroInvalida;
      if (diasEntre(hoje, nascimento) > 0) return copy.data.erroFuturo;
      return "";
    }
    if (modo === "dum") {
      if (!dum) return "";
      if (!ehISOValida(dum)) return copy.data.erroInvalida;
      if (diasEntre(hoje, dum) > 0) return copy.data.erroFuturo;
    }
    const alvo = dppFinal;
    if (!alvo) return "";
    if (!ehISOValida(alvo)) return copy.data.erroInvalida;
    // Mais de 44 semanas à frente não é uma DPP plausível.
    if (diasEntre(hoje, alvo) > 44 * 7) return copy.data.erroMuitoLonge;
    return "";
  }, [modoBebe, nascimento, modo, dum, dppFinal, hoje]);

  const preenchido = modoBebe ? Boolean(nascimento) : Boolean(dppFinal);
  const podeContinuar = preenchido && !erro;

  function continuar() {
    setTocou(true);
    if (!podeContinuar) return;

    if (modoBebe) {
      // ONB-01: cria o bebê na hora; o modo já nasce 'bebe'.
      avancar({ nascidoEm: nascimento, dpp: undefined, dum: undefined });
      return;
    }
    // ONB-02: DPP no passado (> 2 semanas) pede confirmação.
    if (dppNoPassado(dppFinal, hoje) && !confirmarNascido) {
      setConfirmarNascido(true);
      return;
    }
    avancar({ dpp: dppFinal, dum: modo === "dum" ? dum : undefined, nascidoEm: undefined });
  }

  function jaNasceu() {
    // Vira modo bebê e pede a data de nascimento na mesma tela.
    atualizar({ momento: "bebe" });
    setNascimento(dppFinal);
    setConfirmarNascido(false);
  }

  const rodape = (
    <Botao tamanho="lg" largura="total" onClick={continuar} disabled={tocou && !podeContinuar}>
      {copy.continuar}
    </Botao>
  );

  if (modoBebe) {
    return (
      <Pergunta titulo={copy.data.perguntaBebe} apoio={copy.data.apoioBebe} rodape={rodape}>
        <CampoTexto
          rotulo={copy.data.rotuloNascimento}
          type="date"
          value={nascimento}
          max={hoje}
          min={somarDias(hoje, -730)}
          onChange={(e) => setNascimento(e.target.value)}
          erro={tocou || nascimento ? erro || undefined : undefined}
          autoFocus
        />
      </Pergunta>
    );
  }

  return (
    <Pergunta
      titulo={copy.data.perguntaGestacao}
      apoio={copy.data.apoioGestacao}
      rodape={confirmarNascido ? undefined : rodape}
    >
      <div role="tablist" aria-label={copy.data.perguntaGestacao} className="flex rounded-pilula bg-primaria-suave p-1">
        {(["dpp", "dum"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => {
              setModo(m);
              setAjustando(false);
              setConfirmarNascido(false);
            }}
            className={`min-h-10 flex-1 rounded-pilula text-[14px] font-medium transition-colors ${
              modo === m ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"
            }`}
          >
            {m === "dpp" ? copy.data.modoDpp : copy.data.modoDum}
          </button>
        ))}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {modo === "dpp" ? (
          <CampoTexto
            rotulo={copy.data.rotuloDpp}
            type="date"
            value={dpp}
            min={somarDias(hoje, -365)}
            max={somarDias(hoje, 44 * 7)}
            onChange={(e) => {
              setDpp(e.target.value);
              setConfirmarNascido(false);
            }}
            erro={tocou || dpp ? erro || undefined : undefined}
            autoFocus
          />
        ) : (
          <>
            <CampoTexto
              rotulo={copy.data.rotuloDum}
              type="date"
              value={dum}
              max={hoje}
              min={somarDias(hoje, -365)}
              onChange={(e) => {
                setDum(e.target.value);
                setAjustando(false);
                setConfirmarNascido(false);
              }}
              erro={tocou || dum ? erro || undefined : undefined}
              autoFocus
            />
            {dppCalculada && !erro && (
              <Card tom="suave" compacto>
                <p className="tipo-corpo text-primaria-texto">{copy.data.calculada(formatarLonga(dppCalculada))}</p>
                {ajustando ? (
                  <div className="mt-3">
                    <CampoTexto
                      rotulo={copy.data.rotuloDpp}
                      type="date"
                      value={dpp || dppCalculada}
                      onChange={(e) => setDpp(e.target.value)}
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setDpp(dppCalculada);
                      setAjustando(true);
                    }}
                    className="mt-1 min-h-11 text-[14px] font-medium text-primaria-texto underline-offset-4 hover:underline"
                  >
                    {copy.data.ajustar}
                  </button>
                )}
              </Card>
            )}
          </>
        )}

        {confirmarNascido && (
          <Card tom="acento">
            <p className="tipo-saudacao text-texto">{copy.data.passadoTitulo}</p>
            <div className="mt-3 flex flex-col gap-2">
              <Botao largura="total" onClick={jaNasceu}>
                {copy.data.passadoSim}
              </Botao>
              <Botao variant="fantasma" largura="total" onClick={() => setConfirmarNascido(false)}>
                {copy.data.passadoNao}
              </Botao>
            </div>
          </Card>
        )}
      </div>
    </Pergunta>
  );
}
