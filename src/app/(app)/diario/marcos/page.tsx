"use client";

import { Check, ChevronRight, Clock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Cabecalho } from "@/components/ui/Cabecalho";
import { diarioCopy as copy } from "@/copy/diario";
import { reabrirMarco } from "@/lib/diario/acoes";
import { listaDeMarcos } from "@/lib/diario/regras";
import { useDiario } from "@/lib/diario/useDiario";
import type { EstadoMarco, Marco } from "@dominio/diario.ts";

function rotulo(m: Marco, e: EstadoMarco): string {
  return e === "em_breve" ? copy.estados.em_breve(m.window_start_week ?? 0) : copy.estados[e];
}

/** Tela 5 "Marcos": todos os marcos com o estado de cada um. */
export default function PaginaMarcos() {
  const { semanaAtual, modoFe, situacao, agora, eu, entradas } = useDiario();
  const router = useRouter();
  const lista = listaDeMarcos(semanaAtual, modoFe, situacao, agora);

  function abrir(m: Marco, e: EstadoMarco) {
    if (e === "respondido") {
      const entrada = entradas.find((x) => x.milestone_code === m.code && x.criado_por === eu && !x.apagado_em);
      if (entrada) return router.push(`/diario/${entrada.id}`);
    }
    if (e === "pulado" || e === "adiado") reabrirMarco(eu, m.code);
    router.push(`/diario/escrever?marco=${m.code}`);
  }

  return (
    <div>
      <Cabecalho titulo={copy.marcos} voltarPara="/diario" />
      <ul className="flex flex-col gap-2 px-5 pt-1">
        {lista.map(({ marco: m, estado: e }) => (
          <li key={m.code}>
            <button
              type="button"
              disabled={e === "em_breve"}
              onClick={() => abrir(m, e)}
              className="flex min-h-14 w-full items-center gap-3 rounded-card bg-superficie px-4 py-3 text-left disabled:opacity-60 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"
            >
              <span aria-hidden className={`grid size-9 shrink-0 place-items-center rounded-full ${e === "respondido" ? "bg-sucesso text-white" : e === "aberto" ? "bg-acento-suave text-texto" : "bg-fio text-texto-mudo"}`}>
                {e === "respondido" ? <Check size={16} strokeWidth={3} /> : e === "em_breve" ? <Clock size={16} /> : <Sparkles size={16} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium text-texto">{m.title}</span>
                <span className="tipo-meta block">{rotulo(m, e)}</span>
              </span>
              {e !== "em_breve" && <ChevronRight size={18} aria-hidden className="text-texto-mudo" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
