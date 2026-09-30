"use client";

import { Faixa } from "@/components/ui/Faixa";
import { Sheet } from "@/components/ui/Sheet";
import { registrarCopy } from "@/copy/registrar";
import { track } from "@/lib/analytics";
import { contracaoEmAndamento, padraoDeTrabalhoDeParto, resumirContracoes } from "@/lib/chutes-contracoes";
import { novoId, useColecao } from "@/lib/dados/colecao";
import { contracoes } from "@/lib/dados/colecoes";
import { formatarDuracao } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

const copy = registrarCopy.sheetContracoes;

interface Props {
  aberto: boolean;
  onFechar: () => void;
}

/** HG-08: iniciar/parar; duração e intervalo das últimas 6; aviso de padrão em coral, sem diagnóstico. */
export function SheetContracoes({ aberto, onFechar }: Props) {
  const todas = useColecao(contracoes);
  const agora = useAgora(1000);
  const emAndamento = contracaoEmAndamento(todas);
  const ultimas = resumirContracoes(todas, 6, agora);
  const alerta = padraoDeTrabalhoDeParto(todas, agora);

  function alternar() {
    if (emAndamento) {
      contracoes.salvar({ ...emAndamento, fim: new Date().toISOString() });
      const depois = contracoes.listar();
      const umaHora = agora.getTime() - 3_600_000;
      track("contracoes_sessao", {
        n: depois.filter((c) => new Date(c.inicio).getTime() >= umaHora).length,
        alerta_padrao: padraoDeTrabalhoDeParto(depois, new Date()),
      });
    } else {
      contracoes.salvar({ id: novoId(), inicio: new Date().toISOString() });
    }
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.titulo}>
      <p className="tipo-corpo text-texto-mudo">{copy.apoio}</p>
      {alerta && (
        <div className="mt-3">
          <Faixa tom="alerta">{copy.alerta}</Faixa>
        </div>
      )}

      <div className="flex flex-col items-center py-6">
        <button
          type="button"
          onClick={alternar}
          aria-pressed={Boolean(emAndamento)}
          className={`grid size-44 place-items-center rounded-full text-white transition-transform active:scale-95 ${
            emAndamento ? "bg-acento" : "bg-primaria shadow-mais"
          }`}
        >
          <span className="text-[17px] font-medium">{emAndamento ? copy.parar : copy.iniciar}</span>
        </button>
        {emAndamento && (
          <>
            <p className="tipo-heroi mt-6 text-texto">{formatarDuracao((agora.getTime() - new Date(emAndamento.inicio).getTime()) / 1000)}</p>
            <p className="tipo-heroi-rotulo text-texto-mudo">{copy.emAndamento}</p>
          </>
        )}
      </div>

      <h3 className="tipo-titulo-secao text-texto-mudo">{copy.ultimas}</h3>
      {ultimas.length === 0 ? (
        <p className="tipo-corpo mt-2 text-texto-mudo">{copy.vazio}</p>
      ) : (
        <ul className="mt-2 divide-y divide-fio">
          {ultimas.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2.5">
              <span className="tipo-corpo text-texto">
                {new Date(c.inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
              <span className="tipo-meta">
                {copy.duracao} {formatarDuracao(c.duracaoS ?? 0)} · {copy.intervalo} {c.intervaloS === null ? copy.primeira : formatarDuracao(c.intervaloS)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
