"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { track } from "@/lib/analytics";
import { ouvir, suportaReconhecimento, type SessaoVoz } from "@/lib/voz/reconhecer";

interface Props {
  rotuloOuvir: string;
  rotuloParar: string;
  /** Texto final transcrito (a tela junta ao que já está no campo, editável). */
  onTexto: (texto: string) => void;
  /** Transcrição parcial enquanto fala (opcional). */
  onParcial?: (texto: string) => void;
  /** Sem suporte, sem permissão ou erro: quem usa decide o plano B (o diário grava só o áudio). */
  onFalha?: (motivo: "sem_suporte" | "sem_permissao" | "erro") => void;
  onEstado?: (ouvindo: boolean) => void;
}

const MAX_MS = 60_000;

/**
 * Microfone de campo de texto: o mesmo componente de transcrição da captura por voz
 * (Web Speech API em pt-BR, `lib/voz/reconhecer`). Toque para começar, toque para parar.
 */
export function BotaoDitado({ rotuloOuvir, rotuloParar, onTexto, onParcial, onFalha, onEstado }: Props) {
  const [ouvindo, setOuvindo] = useState(false);
  const sessao = useRef<SessaoVoz | null>(null);
  const limite = useRef<number | null>(null);

  useEffect(
    () => () => {
      sessao.current?.cancelar();
      if (limite.current) window.clearTimeout(limite.current);
    },
    [],
  );

  function mudar(v: boolean) {
    setOuvindo(v);
    onEstado?.(v);
  }

  function comecar() {
    if (!suportaReconhecimento()) {
      onFalha?.("sem_suporte");
      return;
    }
    let falhou = false;
    const s = ouvir({
      onParcial: (t) => onParcial?.(t),
      onFinal: (t) => {
        mudar(false);
        sessao.current = null;
        if (limite.current) window.clearTimeout(limite.current);
        if (t) onTexto(t);
      },
      onErro: (motivo) => {
        if (falhou) return;
        falhou = true;
        if (motivo === "sem_permissao") track("voz_sem_permissao", {});
        onFalha?.(motivo === "sem_permissao" ? "sem_permissao" : "erro");
      },
    });
    if (!s) {
      onFalha?.("erro");
      return;
    }
    sessao.current = s;
    track("voz_iniciada", { modo: "gestacao", motor: "web_speech" });
    mudar(true);
    limite.current = window.setTimeout(() => sessao.current?.parar(), MAX_MS);
  }

  function parar() {
    if (limite.current) window.clearTimeout(limite.current);
    sessao.current?.parar();
  }

  return (
    <button
      type="button"
      aria-label={ouvindo ? rotuloParar : rotuloOuvir}
      aria-pressed={ouvindo}
      onClick={() => (ouvindo ? parar() : comecar())}
      className={`grid size-11 place-items-center rounded-full ${ouvindo ? "bg-acento text-white" : "bg-primaria-suave text-primaria-texto"}`}
    >
      {ouvindo ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}
    </button>
  );
}
