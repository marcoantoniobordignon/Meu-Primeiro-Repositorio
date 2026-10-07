"use client";

import { Pill } from "lucide-react";
import { useCallback, useState } from "react";

import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy } from "@/copy/consultas";
import { medicamentosCopy as copy } from "@/copy/medicamentos";
import { track } from "@/lib/analytics";
import { adicionarPergunta } from "@/lib/consultas-acoes";
import { medicationDoses, medications, type Medication } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { desfazerDose, tomarDose, tomarSeNecessario } from "@/lib/medicamentos/acoes";
import { ativos, casarMedicamento, dosePendenteMaisProxima } from "@/lib/medicamentos/regras";
import { intencaoLocal } from "@/lib/voz/intencoes";

/**
 * Intenções locais da voz: "tomei o ferro" (medicamentos RN-12) e "pergunta para o médico"
 * (consultas RN-08). Um único remédio casado registra e oferece "Desfazer" por 5 s;
 * zero ou vários abrem o sheet para escolher.
 */
export function useIntencoesDeVoz() {
  const { permissoes, papel } = useFamilia();
  const { mostrar } = useToast();
  const [escolha, setEscolha] = useState<Medication[] | null>(null);

  const registrar = useCallback(
    (m: Medication) => {
      const agora = new Date();
      const dose = dosePendenteMaisProxima(medicationDoses.listar(), m.id, agora);
      const antes = dose ? { ...dose } : null;
      const depois = dose ? tomarDose(dose, agora, "voice").dose : tomarSeNecessario(m, agora, "voice");
      track("med_dose_taken", { source: "voice", minutes_late: dose?.scheduled_at ? Math.round((agora.getTime() - new Date(dose.scheduled_at).getTime()) / 60_000) : 0 });
      mostrar(copy.vozRegistrada(m.name), { acao: { rotulo: copy.desfazer, onClick: () => desfazerDose(antes, depois) }, duracaoMs: 5000 });
    },
    [mostrar],
  );

  const tratar = useCallback(
    (texto: string): boolean => {
      const i = intencaoLocal(texto);
      if (!i) return false;
      if (i.tipo === "pergunta") {
        if (!permissoes.verAgenda) return false;
        adicionarPergunta(i.texto);
        track("appt_question_added", { source: papel === "parceiro" ? "partner" : "voice" });
        mostrar(consultasCopy.perguntaSalva);
        return true;
      }
      if (!permissoes.verMedicamentos) return false;
      const lista = ativos(medications.listar());
      const achados = casarMedicamento(i.nome, lista);
      track("med_voice_logged", { matched: achados.length === 1 });
      if (achados.length === 1) registrar(achados[0]!);
      else if (lista.length === 0) mostrar(copy.vozNaoAchei);
      else setEscolha(achados.length ? achados : lista);
      return true;
    },
    [permissoes.verAgenda, permissoes.verMedicamentos, papel, mostrar, registrar],
  );

  const sheet = (
    <Sheet aberto={escolha !== null} onFechar={() => setEscolha(null)} titulo={copy.vozQual}>
      <ul className="flex flex-col gap-2 pb-2">
        {(escolha ?? []).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => {
                setEscolha(null);
                registrar(m);
              }}
              className="flex min-h-13 w-full items-center gap-3 rounded-card border border-fio bg-superficie px-4 text-left text-[15px] text-texto"
            >
              <Pill size={18} aria-hidden className="text-primaria-texto" />
              {m.name}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );

  return { tratar, sheet };
}
