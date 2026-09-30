"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { SeletorHora } from "@/components/ui/SeletorHora";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { bebeCopy as copy } from "@/copy/bebe";
import { arredondar5min, validarInicio } from "@/lib/bebe/registros";
import type { DadosFralda, RegistroBebe } from "@/lib/dados/colecoes";

import { apagarRegistro, atualizarRegistro, criarRegistro } from "./acoes";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  bebeId: string;
  registro?: RegistroBebe | null;
}

const opcoes: { v: DadosFralda["conteudo"]; t: string; emoji: string }[] = [
  { v: "xixi", t: copy.fralda.xixi, emoji: "💧" },
  { v: "coco", t: copy.fralda.coco, emoji: "💩" },
  { v: "ambos", t: copy.fralda.ambos, emoji: "💧💩" },
  { v: "seca", t: copy.fralda.seca, emoji: "✨" },
];

/** Sheet "Fralda": um toque registra agora; ajustar hora fica embaixo. */
export function SheetFralda({ aberto, onFechar, bebeId, registro }: Props) {
  const [quando, setQuando] = useState(() => arredondar5min(new Date()));
  const [ajustando, setAjustando] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    setAjustando(Boolean(registro));
    setQuando(registro ? new Date(registro.inicio) : arredondar5min(new Date()));
  }, [aberto, registro]);

  const erro = validarInicio(quando);

  function registrar(conteudo: DadosFralda["conteudo"]) {
    if (erro !== "ok") return;
    const dados: DadosFralda = { conteudo };
    if (registro) atualizarRegistro(registro, { dados, inicio: quando.toISOString(), fim: quando.toISOString() }, "conteudo");
    else criarRegistro(bebeId, "fralda", ajustando ? quando : new Date(), ajustando ? quando : new Date(), dados);
    mostrar(copy.fralda.registrada);
    onFechar();
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.fralda.titulo}>
      <div className="grid grid-cols-2 gap-3">
        {opcoes.map((o) => (
          <button key={o.v} type="button" onClick={() => registrar(o.v)} className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-card bg-superficie text-texto active:scale-[0.97] [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
            <span aria-hidden className="text-[28px] leading-none">{o.emoji}</span>
            <span className="text-[15px] font-medium">{o.t}</span>
          </button>
        ))}
      </div>
      <div className="mt-4">
        {ajustando ? (
          <SeletorHora rotulo={copy.fralda.quando} valor={quando} onChange={setQuando} erro={erro === "futuro" ? copy.erro.futuro : erro === "antigo" ? copy.erro.antigo : undefined} />
        ) : (
          <Botao variant="fantasma" largura="total" onClick={() => setAjustando(true)}>
            {copy.sono.ajustarHora}
          </Botao>
        )}
      </div>
      {registro && (
        <div className="mt-3">
          <Botao
            largura="total"
            variant="fantasma"
            onClick={() => {
              const desfazer = apagarRegistro(registro);
              mostrar(copy.apagado(copy.tiles.fralda), { acao: { rotulo: copy.desfazer, onClick: desfazer } });
              onFechar();
            }}
          >
            {copy.apagar}
          </Botao>
        </div>
      )}
    </Sheet>
  );
}
