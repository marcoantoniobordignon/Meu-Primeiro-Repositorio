"use client";

import { MessageCircleQuestion, Trash2 } from "lucide-react";
import { useState } from "react";

import { BotaoDitado } from "@/components/features/voz/BotaoDitado";
import { Botao } from "@/components/ui/Botao";
import { CampoArea } from "@/components/ui/CampoArea";
import { useToast } from "@/components/ui/Toast";
import { consultasCopy as copy } from "@/copy/consultas";
import { track } from "@/lib/analytics";
import { perguntaValida } from "@/lib/consultas";
import { adicionarPergunta, apagarPergunta } from "@/lib/consultas-acoes";
import { useColecao } from "@/lib/dados/colecao";
import { appointmentQuestions, appointments, type Appointment } from "@/lib/dados/colecoes";
import { nomeDoAutor } from "@/lib/familia/regras";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAgora } from "@/lib/hooks/useAgora";
import { useFuso } from "@/lib/hooks/useFuso";
import { pautaDaConsulta, proximaConsulta } from "@dominio/consultas.ts";

interface Props {
  /** Sem consulta: a pauta da próxima (ou das soltas, se não houver nenhuma). */
  consulta?: Appointment;
}

/** Pauta (RN-02): perguntas pendentes e o campo para escrever ou ditar. Parceiro também anota (RN-10). */
export function Pauta({ consulta }: Props) {
  const perguntas = useColecao(appointmentQuestions);
  const todas = useColecao(appointments);
  const { membros, meuId, papel } = useFamilia();
  const tz = useFuso();
  const agora = useAgora(60_000);
  const [texto, setTexto] = useState("");
  const [parcial, setParcial] = useState("");
  const [tocou, setTocou] = useState(false);
  const [origem, setOrigem] = useState<"text" | "voice">("text");
  const { mostrar } = useToast();
  const proxima = proximaConsulta(todas, agora, tz);
  const alvo = consulta ?? proxima;
  const lista = pautaDaConsulta(alvo, proxima, perguntas);

  function anotar() {
    setTocou(true);
    if (!perguntaValida(texto)) return;
    adicionarPergunta(texto, consulta && consulta.id !== proxima?.id ? consulta.id : null);
    track("appt_question_added", { source: papel === "parceiro" ? "partner" : origem });
    if (papel === "parceiro") track("partner_question_added", {});
    mostrar(copy.perguntaSalva);
    setTexto("");
    setOrigem("text");
    setTocou(false);
  }

  return (
    <div className="flex flex-col gap-3">
      {lista.length === 0 ? (
        <p className="tipo-corpo text-texto-mudo">{copy.pautaVazia}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((p) => (
            <li key={p.id} className="flex items-start gap-3 rounded-card bg-superficie py-2 pl-4 pr-1 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
              <MessageCircleQuestion size={18} aria-hidden className="mt-2.5 shrink-0 text-primaria-texto" />
              <span className="min-w-0 flex-1 py-2">
                <span className="tipo-corpo block text-texto">{p.text}</span>
                {p.criado_por && p.criado_por !== meuId && <span className="tipo-meta block">{copy.porQuem(nomeDoAutor(p.criado_por, meuId, membros))}</span>}
              </span>
              <button
                type="button"
                aria-label={copy.apagarPergunta(p.text)}
                onClick={() => {
                  apagarPergunta(p);
                  mostrar(copy.perguntaApagada);
                }}
                className="grid size-11 shrink-0 place-items-center rounded-pilula text-texto-mudo active:bg-primaria-suave"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <CampoArea
        rotulo={copy.novaPergunta}
        semRotulo
        placeholder={parcial || copy.perguntaPlaceholder}
        value={texto}
        maxLength={280}
        rows={2}
        onChange={(e) => setTexto(e.target.value)}
        erro={tocou && !perguntaValida(texto) ? copy.perguntaErro : undefined}
        acessorio={
          <BotaoDitado
            rotuloOuvir={copy.ditar}
            rotuloParar={copy.pararDitado}
            onParcial={setParcial}
            onTexto={(t) => {
              setParcial("");
              setTexto((atual) => (atual ? `${atual} ${t}` : t).slice(0, 280));
              setOrigem("voice");
            }}
            onFalha={() => mostrar(copy.semVoz)}
          />
        }
      />
      <Botao largura="total" variant="secundario" onClick={anotar}>
        {copy.adicionarPergunta}
      </Botao>
    </div>
  );
}
