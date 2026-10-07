"use client";

import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { useToast } from "@/components/ui/Toast";
import { planoCopy as copy } from "@/copy/planoParto";
import { track } from "@/lib/analytics";
import { concluir } from "@/lib/plano/acoes";
import { usePlano } from "@/lib/plano/usePlano";
import type { Etapa as NumeroEtapa } from "@dominio/plano-parto.ts";

/** Moldura das etapas: título, conteúdo e "Concluir etapa" (RN-01: não exige campos). */
export function Etapa({ numero, titulo, children }: { numero: NumeroEtapa; titulo: string; children: ReactNode }) {
  const { plano, editar, ver, perfil } = usePlano();
  const router = useRouter();
  const { mostrar } = useToast();
  if (!perfil) return null;
  if (!ver || !plano) return <Cabecalho titulo={titulo} voltarPara="/plano-parto" />;
  const feita = plano.completed_steps.includes(numero);
  return (
    <div>
      <Cabecalho titulo={titulo} voltarPara="/plano-parto" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        {!editar && numero !== 4 && numero !== 5 && <p className="tipo-meta">{copy.somenteLeitura}</p>}
        {children}
        {editar &&
          (feita ? (
            <p className="tipo-corpo flex items-center justify-center gap-2 text-sucesso">
              <Check size={18} aria-hidden />
              {copy.etapaConcluida}
            </p>
          ) : (
            <Botao
              largura="total"
              tamanho="lg"
              onClick={() => {
                concluir(plano, numero);
                track("bp_step_completed", { step: numero });
                mostrar(copy.etapaConcluida);
                router.push("/plano-parto");
              }}
            >
              {copy.concluir}
            </Botao>
          ))}
      </div>
    </div>
  );
}
