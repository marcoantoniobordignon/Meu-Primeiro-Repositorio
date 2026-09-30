"use client";

import { Activity, Footprints } from "lucide-react";

import { Botao } from "@/components/ui/Botao";
import { home as copy } from "@/copy/home";
import { contracaoEmAndamento, padraoDeTrabalhoDeParto, sessaoAtiva } from "@/lib/chutes-contracoes";
import { useColecao } from "@/lib/dados/colecao";
import { contracoes, sessoesChutes } from "@/lib/dados/colecoes";
import { haQuantoTempo } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

interface Props {
  onAbrirChutes: () => void;
  onAbrirContracoes: () => void;
}

/** Cards na home enquanto há contagem de chutes ou contrações recentes (spec 05). */
export function CardsAtivos({ onAbrirChutes, onAbrirContracoes }: Props) {
  const sessoes = useColecao(sessoesChutes);
  const todasContracoes = useColecao(contracoes);
  const agora = useAgora(15_000);

  const chutes = sessaoAtiva(sessoes);
  const emAndamento = contracaoEmAndamento(todasContracoes);
  const ultimaContracao = [...todasContracoes].sort((a, b) => b.inicio.localeCompare(a.inicio))[0];
  const contracoesRecentes = Boolean(emAndamento) || (ultimaContracao && agora.getTime() - new Date(ultimaContracao.inicio).getTime() < 3_600_000);
  const alerta = padraoDeTrabalhoDeParto(todasContracoes, agora);

  if (!chutes && !contracoesRecentes) return null;

  return (
    <div className="flex flex-col gap-3">
      {chutes && (
        <div className="flex items-center gap-3 rounded-card bg-banho px-4 py-3 text-white">
          <Footprints size={20} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">{copy.chutes.ativo}</p>
            <p className="text-[12px] opacity-90">
              {copy.chutes.resumo(chutes.total, Math.max(0, Math.round((agora.getTime() - new Date(chutes.inicio).getTime()) / 60_000)))}
            </p>
          </div>
          <Botao variant="secundario" onClick={onAbrirChutes}>
            {copy.chutes.continuar}
          </Botao>
        </div>
      )}
      {contracoesRecentes && (
        <div className={`flex items-center gap-3 rounded-card px-4 py-3 ${alerta ? "bg-acento text-white" : "bg-superficie text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"}`}>
          <Activity size={20} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">{copy.contracoes.ativo}</p>
            <p className={`text-[12px] ${alerta ? "opacity-95" : "text-texto-mudo"}`}>
              {alerta ? copy.contracoes.alerta : emAndamento ? copy.contracoes.emAndamento : copy.contracoes.ultima(haQuantoTempo(ultimaContracao!.inicio, agora))}
            </p>
          </div>
          <Botao variant="secundario" onClick={onAbrirContracoes}>
            {copy.contracoes.abrir}
          </Botao>
        </div>
      )}
    </div>
  );
}
