"use client";

import { Footprints } from "lucide-react";
import { useEffect } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { registrarCopy } from "@/copy/registrar";
import { track } from "@/lib/analytics";
import { CHUTES_MAXIMO, sessaoAtiva, sessaoDeveEncerrar } from "@/lib/chutes-contracoes";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { sessoesChutes, type SessaoChutes } from "@/lib/dados/colecoes";
import { formatarDuracao } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

const copy = registrarCopy.sheetChutes;

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

/** HG-07: botão grande a cada chute; encerra sozinho em 10 chutes ou 2 h, com toast. */
export function SheetChutes({ aberto, onFechar }: Props) {
  const todas = useColecao(sessoesChutes);
  const ativa = sessaoAtiva(todas);
  const agora = useAgora(1000);
  const { mostrar } = useToast();
  const decorrido = ativa ? (agora.getTime() - new Date(ativa.inicio).getTime()) / 1000 : 0;

  function encerrar(s: SessaoChutes) {
    const fim = new Date();
    const minutos = Math.max(1, Math.round((fim.getTime() - new Date(s.inicio).getTime()) / 60_000));
    sessoesChutes.salvar({ ...s, fim: fim.toISOString() });
    track("chutes_sessao", { total: s.total, minutos });
    mostrar(copy.encerrada(s.total, formatarDuracao((fim.getTime() - new Date(s.inicio).getTime()) / 1000)));
    onFechar();
  }

  useEffect(() => {
    if (ativa && sessaoDeveEncerrar(ativa, agora)) encerrar(ativa);
  }, [ativa, agora]);

  function chute() {
    if (ativa) {
      sessoesChutes.salvar({ ...ativa, total: ativa.total + 1 });
    } else {
      sessoesChutes.salvar({ id: novoId(), inicio: new Date().toISOString(), total: 1 });
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.titulo}>
      <p className="tipo-corpo text-texto-mudo">{copy.apoio}</p>
      <div className="flex flex-col items-center py-6">
        <button
          type="button"
          onClick={chute}
          className="grid size-44 place-items-center rounded-full bg-primaria text-white shadow-mais transition-transform active:scale-95"
        >
          <span className="flex flex-col items-center gap-1">
            <Footprints size={34} aria-hidden />
            <span className="text-[15px] font-medium">{copy.botao}</span>
          </span>
        </button>
        <p className="tipo-heroi mt-6 text-texto">{ativa?.total ?? 0}</p>
        <p className="tipo-heroi-rotulo text-texto-mudo">{copy.contagem(ativa?.total ?? 0).replace(/^\d+ /, "")}</p>
        <p className="tipo-meta mt-2">{ativa ? formatarDuracao(decorrido) : `0 de ${CHUTES_MAXIMO}`}</p>
      </div>
      {ativa && (
        <Botao largura="total" variant="secundario" onClick={() => encerrar(ativa)}>
          {copy.encerrar}
        </Botao>
      )}
    </Sheet>
  );
}
