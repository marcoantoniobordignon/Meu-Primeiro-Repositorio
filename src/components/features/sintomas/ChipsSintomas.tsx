"use client";

import { Plus } from "lucide-react";

import { Chip } from "@/components/ui/Chip";
import { useToast } from "@/components/ui/Toast";
import { sintomasCopy as copy } from "@/copy/sintomas";
import { useColecao } from "@/lib/dados/colecao";
import { sintomas as colecao } from "@/lib/dados/colecoes";
import { dataDoRegistro } from "@/lib/dates";
import { corDoGrupo, type Especial } from "@/lib/sintomas/catalogo";
import { chipsDaHome, registrosDoDia } from "@/lib/sintomas/regras";

import { definirIntensidade } from "./acoes";
import { SheetMadrugada } from "./SheetMadrugada";
import { useDiaDoRegistro } from "./useDiaDoRegistro";

interface Props {
  semana: number;
  modoBebe?: boolean;
  onMais: () => void;
  onEspecial: (especial: Especial) => void;
}

/** SIN-01/02/04: linha rolável de chips; um toque registra hoje com intensidade leve. */
export function ChipsSintomas({ semana, modoBebe = false, onMais, onEspecial }: Props) {
  const todos = useColecao(colecao);
  const { mostrar } = useToast();
  const dia = useDiaDoRegistro();
  const { hoje, ontem, madrugada } = dataDoRegistro();
  // Na madrugada, "hoje" para a linha de chips pode ser ontem: mostramos os dois dias como registrados.
  const registrados = registrosDoDia(todos, hoje).concat(madrugada ? registrosDoDia(todos, ontem) : []);
  const chips = chipsDaHome(registrados, semana, modoBebe);
  const marcados = new Set(registrados.map((s) => s.slug));

  return (
    <>
      <div className="scroll-x-sem-barra -mx-5 flex gap-2 px-5">
        {chips.map((item) => (
          <Chip
            key={item.slug}
            cor={corDoGrupo[item.grupo]}
            selecionado={!item.especial && marcados.has(item.slug)}
            onToggle={(ligar) => {
              if (item.especial) return onEspecial(item.especial);
              dia.decidir((data) => {
                definirIntensidade(item.slug, data, ligar ? 1 : null, "chip");
                mostrar(ligar ? copy.registrado(item.nome) : copy.removido(item.nome));
              });
            }}
          >
            {item.nome}
          </Chip>
        ))}
        <button
          type="button"
          onClick={onMais}
          aria-label={copy.mais}
          className="grid size-11 shrink-0 place-items-center rounded-pilula border border-fio bg-superficie text-primaria-texto active:scale-95"
        >
          <Plus size={18} />
        </button>
      </div>
      <SheetMadrugada aberto={dia.perguntando} onResponder={dia.responder} onCancelar={dia.cancelar} />
    </>
  );
}
