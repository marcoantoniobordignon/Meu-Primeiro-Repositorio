"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { diarioCopy as copy } from "@/copy/diario";
import { track } from "@/lib/analytics";
import { adiarMarco, pularMarco } from "@/lib/diario/acoes";
import { perguntaDoMarco, type Marco } from "@dominio/diario.ts";

const mostrados = new Set<string>();

/** Card do marco (RN-03): pergunta pronta, "Responder", "Pular" (de vez) e "Mais tarde" (3 dias). */
export function CardMarco({ marco, modoFe, autor }: { marco: Marco; modoFe: boolean; autor: string }) {
  const router = useRouter();
  const { mostrar } = useToast();

  useEffect(() => {
    // Uma vez por abertura do app, por marco.
    if (mostrados.has(marco.code)) return;
    mostrados.add(marco.code);
    track("diary_milestone_shown", { code: marco.code });
  }, [marco.code]);

  return (
    <section className="rounded-card bg-acento-suave px-4 py-3.5">
      <div className="flex items-start gap-3">
        <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-superficie text-texto">
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="tipo-saudacao text-texto">{marco.title}</h2>
          <p className="tipo-corpo mt-0.5 text-texto">{perguntaDoMarco(marco, modoFe)}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Botao largura="total" onClick={() => router.push(`/diario/escrever?marco=${marco.code}`)}>
          {copy.responder}
        </Botao>
        <Botao
          variant="secundario"
          onClick={() => {
            adiarMarco(autor, marco.code);
            track("diary_milestone_snoozed", { code: marco.code });
            mostrar(copy.adiado);
          }}
        >
          {copy.maisTarde}
        </Botao>
        <Botao
          variant="fantasma"
          onClick={() => {
            pularMarco(autor, marco.code);
            track("diary_milestone_skipped", { code: marco.code });
            mostrar(copy.pulado);
          }}
        >
          {copy.pular}
        </Botao>
      </div>
    </section>
  );
}
