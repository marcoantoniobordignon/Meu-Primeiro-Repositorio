"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { SeletorHora } from "@/components/ui/SeletorHora";
import { Sheet } from "@/components/ui/Sheet";
import { Teclado } from "@/components/ui/Teclado";
import { useToast } from "@/components/ui/Toast";
import { bebeCopy as copy } from "@/copy/bebe";
import { arredondar5min, mamadaEmAndamento, segundosPorLado, validarInicio, volumesFrequentes } from "@/lib/bebe/registros";
import { useColecao } from "@/lib/dados/colecao";
import { registrosBebe, type DadosMamada, type RegistroBebe } from "@/lib/dados/colecoes";
import { formatarDuracao } from "@/lib/dates";
import { useAgora } from "@/lib/hooks/useAgora";

import { apagarRegistro, atualizarRegistro, criarRegistro, encerrar, iniciarPeito, trocarLadoPeito } from "./acoes";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  bebeId: string;
  registro?: RegistroBebe | null;
}

type Aba = "peito" | "mamadeira" | "bomba";

/** Sheet "Mamada": peito com timer por lado, mamadeira com teclado e atalhos, bomba (BEB-04/05). */
export function SheetMamada({ aberto, onFechar, bebeId, registro }: Props) {
  const todos = useColecao(registrosBebe);
  const agora = useAgora(1000);
  const emAndamento = registro?.fim === null ? registro : mamadaEmAndamento(todos, bebeId);
  const editando = Boolean(registro && registro.fim !== null);
  const dadosEdit = registro?.dados as DadosMamada | undefined;
  const [aba, setAba] = useState<Aba>("peito");
  const [ml, setMl] = useState("");
  const [leite, setLeite] = useState<"mamadeira" | "formula">("mamadeira");
  const [ladoBomba, setLadoBomba] = useState<"E" | "D" | "ambos">("ambos");
  const [quando, setQuando] = useState(() => arredondar5min(new Date()));
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    if (editando && dadosEdit) {
      setAba(dadosEdit.tipo === "peito" ? "peito" : dadosEdit.tipo === "bomba" ? "bomba" : "mamadeira");
      setMl(dadosEdit.ml ? String(dadosEdit.ml) : "");
      setLeite(dadosEdit.tipo === "formula" ? "formula" : "mamadeira");
      setLadoBomba(dadosEdit.lado === "E" || dadosEdit.lado === "D" ? dadosEdit.lado : "ambos");
      setQuando(new Date(registro!.fim!));
    } else {
      setMl("");
      setQuando(arredondar5min(new Date()));
    }
  }, [aberto, editando, dadosEdit, registro]);

  const erroQuando = validarInicio(quando);
  const atalhos = volumesFrequentes(todos, bebeId);

  function salvarVolume() {
    const volume = Number(ml);
    if (!volume) return;
    const tipo = aba === "bomba" ? "bomba" : leite;
    const dados: DadosMamada = { tipo, ml: volume, lado: aba === "bomba" ? ladoBomba : null };
    if (editando && registro) atualizarRegistro(registro, { dados, fim: quando.toISOString(), inicio: quando.toISOString() }, "volume");
    else criarRegistro(bebeId, "mamada", quando, quando, dados);
    mostrar(copy.mamada.registrada);
    onFechar();
  }

  function apagar() {
    if (!registro) return;
    const desfazer = apagarRegistro(registro);
    mostrar(copy.apagado(copy.tiles.mamada), { acao: { rotulo: copy.desfazer, onClick: desfazer } });
    onFechar();
  }

  const abas: { v: Aba; t: string }[] = [
    { v: "peito", t: copy.mamada.peito },
    { v: "mamadeira", t: copy.mamada.mamadeira },
    { v: "bomba", t: copy.mamada.bomba },
  ];

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.mamada.titulo}>
      {emAndamento && !editando ? (
        <TimerPeito r={emAndamento} agora={agora} onFechar={onFechar} />
      ) : (
        <div className="flex flex-col gap-4">
          <div role="tablist" className="flex rounded-pilula bg-primaria-suave p-1">
            {abas.map(({ v, t }) => (
              <button key={v} type="button" role="tab" aria-selected={aba === v} onClick={() => setAba(v)} className={`min-h-10 flex-1 rounded-pilula text-[14px] font-medium ${aba === v ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"}`}>
                {t}
              </button>
            ))}
          </div>

          {aba === "peito" && !editando && (
            <div className="grid grid-cols-2 gap-3 py-2">
              {(["E", "D"] as const).map((lado) => (
                <button
                  key={lado}
                  type="button"
                  onClick={() => {
                    iniciarPeito(bebeId, lado);
                    mostrar(copy.mamada.iniciada(lado === "E" ? "esquerdo" : "direito"));
                    onFechar();
                  }}
                  className="flex aspect-square flex-col items-center justify-center rounded-card bg-mamada text-white active:scale-[0.97]"
                >
                  <span className="tipo-heroi">{lado}</span>
                  <span className="text-[14px] font-medium">{lado === "E" ? copy.mamada.esquerdo : copy.mamada.direito}</span>
                </button>
              ))}
            </div>
          )}

          {aba === "peito" && editando && dadosEdit && (
            <div className="flex flex-col gap-4">
              <p className="tipo-corpo text-texto-mudo">
                E {Math.round(segundosPorLado(dadosEdit).E / 60)} min · D {Math.round(segundosPorLado(dadosEdit).D / 60)} min
              </p>
              <SeletorHora rotulo={copy.mamada.quando} valor={quando} onChange={setQuando} />
              <Botao largura="total" tamanho="lg" onClick={() => {
                const dur = new Date(registro!.fim!).getTime() - new Date(registro!.inicio).getTime();
                atualizarRegistro(registro!, { fim: quando.toISOString(), inicio: new Date(quando.getTime() - dur).toISOString() }, "horario");
                mostrar(copy.mamada.registrada);
                onFechar();
              }}>
                {copy.mamada.registrar}
              </Botao>
            </div>
          )}

          {aba !== "peito" && (
            <div className="flex flex-col gap-4">
              {aba === "mamadeira" ? (
                <div role="radiogroup" className="flex gap-2">
                  {(["mamadeira", "formula"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={leite === v} onClick={() => setLeite(v)} className={`min-h-11 flex-1 rounded-pilula border text-[14px] font-medium ${leite === v ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"}`}>
                      {v === "mamadeira" ? copy.mamada.leite : copy.mamada.formula}
                    </button>
                  ))}
                </div>
              ) : (
                <div role="radiogroup" className="flex gap-2">
                  {(["E", "D", "ambos"] as const).map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={ladoBomba === v} onClick={() => setLadoBomba(v)} className={`min-h-11 flex-1 rounded-pilula border text-[14px] font-medium ${ladoBomba === v ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"}`}>
                      {v === "E" ? copy.mamada.esquerdo : v === "D" ? copy.mamada.direito : copy.fralda.ambos}
                    </button>
                  ))}
                </div>
              )}
              <Teclado valor={ml} onChange={setMl} atalhos={aba === "mamadeira" ? atalhos : []} rotuloApagar={copy.apagar} />
              <SeletorHora rotulo={copy.mamada.quando} valor={quando} onChange={setQuando} erro={erroQuando === "futuro" ? copy.erro.futuro : erroQuando === "antigo" ? copy.erro.antigo : undefined} />
              <Botao largura="total" tamanho="lg" onClick={salvarVolume} disabled={!Number(ml) || erroQuando !== "ok"}>
                {copy.mamada.registrar}
              </Botao>
            </div>
          )}

          {editando && (
            <Botao largura="total" variant="fantasma" onClick={apagar}>
              {copy.apagar}
            </Botao>
          )}
        </div>
      )}
    </Sheet>
  );
}

function TimerPeito({ r, agora, onFechar }: { r: RegistroBebe; agora: Date; onFechar: () => void }) {
  const d = r.dados as DadosMamada;
  const s = segundosPorLado(d, agora);
  const { mostrar } = useToast();
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        {(["E", "D"] as const).map((lado) => {
          const ativo = d.lado === lado;
          return (
            <button
              key={lado}
              type="button"
              aria-pressed={ativo}
              onClick={() => !ativo && trocarLadoPeito(r, lado)}
              className={`flex aspect-square flex-col items-center justify-center rounded-card transition-colors ${ativo ? "bg-mamada text-white" : "bg-superficie text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio"}`}
            >
              <span className="tipo-heroi">{lado}</span>
              <span className="mt-1 text-[16px] font-medium tabular-nums">{formatarDuracao(s[lado])}</span>
              {!ativo && <span className="tipo-meta mt-1">{copy.mamada.trocarLado}</span>}
            </button>
          );
        })}
      </div>
      <Botao
        largura="total"
        tamanho="lg"
        onClick={() => {
          encerrar(r);
          mostrar(copy.mamada.registrada);
          onFechar();
        }}
      >
        {copy.mamada.encerrar}
      </Botao>
    </div>
  );
}
