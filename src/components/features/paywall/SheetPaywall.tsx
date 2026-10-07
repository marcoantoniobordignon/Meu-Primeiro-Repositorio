"use client";

import { Sparkles } from "lucide-react";
import { useEffect } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { paywallCopy as copy } from "@/copy/paywall";
import { track, type Eventos } from "@/lib/analytics";

type Gatilho = Eventos["paywall_shown"];

interface Props {
  aberto: boolean;
  gatilho: Gatilho;
  onFechar: () => void;
  /** Saída sem assinar que não perde nada ("Salvar sem o áudio", "Exportar em 720p"). */
  alternativa?: { rotulo: string; onClick: () => void };
}

/** Paywall das funcionalidades: diz o limite, oferece o Completo e sempre deixa seguir sem perder nada. */
export function SheetPaywall({ aberto, gatilho, onFechar, alternativa }: Props) {
  const { mostrar } = useToast();
  const { feature, trigger } = gatilho;

  useEffect(() => {
    if (aberto) track("paywall_shown", { feature, trigger });
  }, [aberto, feature, trigger]);

  return (
    <Sheet
      aberto={aberto}
      onFechar={onFechar}
      titulo={copy.titulo}
      rodape={
        <div className="flex flex-col gap-2">
          <Botao
            largura="total"
            tamanho="lg"
            onClick={() => {
              mostrar(copy.emBreve);
              onFechar();
            }}
          >
            {copy.quero}
          </Botao>
          <Botao
            largura="total"
            variant="fantasma"
            onClick={() => {
              alternativa?.onClick();
              onFechar();
            }}
          >
            {alternativa?.rotulo ?? copy.agoraNao}
          </Botao>
        </div>
      }
    >
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
          <Sparkles size={18} />
        </span>
        <p className="tipo-corpo text-texto">{copy.motivos[feature]}</p>
      </div>
    </Sheet>
  );
}
