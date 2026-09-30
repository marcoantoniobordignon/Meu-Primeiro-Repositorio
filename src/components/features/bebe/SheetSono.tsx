"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { SeletorHora } from "@/components/ui/SeletorHora";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { bebeCopy as copy } from "@/copy/bebe";
import { arredondar5min, sonoEmAndamento, validarInicio } from "@/lib/bebe/registros";
import { useColecao } from "@/lib/dados/colecao";
import { registrosBebe, type RegistroBebe } from "@/lib/dados/colecoes";
import { formatarHora } from "@/lib/dates";

import { apagarRegistro, atualizarRegistro, criarRegistro, encerrar } from "./acoes";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  bebeId: string;
  /** Editar um registro existente (linha do tempo). */
  registro?: RegistroBebe | null;
}

/** Sheet "Sono": timer, ou início e fim; em andamento oferece "Acordou agora" (BEB-02/03/06). */
export function SheetSono({ aberto, onFechar, bebeId, registro }: Props) {
  const todos = useColecao(registrosBebe);
  const emAndamento = registro?.fim === null ? registro : sonoEmAndamento(todos, bebeId);
  const editando = registro && registro.fim !== null;
  const [modo, setModo] = useState<"escolha" | "informar" | "ajustar">("escolha");
  const [inicio, setInicio] = useState(() => arredondar5min(new Date()));
  const [fim, setFim] = useState(() => arredondar5min(new Date()));
  const [confirmarAnterior, setConfirmarAnterior] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    const agora = arredondar5min(new Date());
    setConfirmarAnterior(false);
    if (editando) {
      setModo("informar");
      setInicio(new Date(registro.inicio));
      setFim(new Date(registro.fim!));
    } else if (emAndamento) {
      setModo("escolha");
      setInicio(new Date(emAndamento.inicio));
      setFim(agora);
    } else {
      setModo("escolha");
      setInicio(new Date(agora.getTime() - 30 * 60_000));
      setFim(agora);
    }
  }, [aberto, editando, registro, emAndamento]);

  const erroInicio = validarInicio(inicio);
  const erroFim = fim < inicio ? "ordem" : validarInicio(fim);

  function comecarAgora() {
    if (emAndamento && !editando) {
      setConfirmarAnterior(true);
      return;
    }
    criarRegistro(bebeId, "sono", new Date(), null, {}, "timer");
    mostrar(copy.sono.iniciado);
    onFechar();
  }

  function salvarInformado() {
    if (erroInicio !== "ok" || erroFim !== "ok") return;
    if (editando) atualizarRegistro(registro, { inicio: inicio.toISOString(), fim: fim.toISOString() }, "horario");
    else criarRegistro(bebeId, "sono", inicio, fim, {});
    mostrar(copy.sono.registrado);
    onFechar();
  }

  function acordou(quando: Date) {
    if (!emAndamento) return;
    encerrar(emAndamento, quando);
    mostrar(copy.sono.registrado);
    onFechar();
  }

  function apagar() {
    if (!registro) return;
    const desfazer = apagarRegistro(registro);
    mostrar(copy.apagado(copy.tiles.sono), { acao: { rotulo: copy.desfazer, onClick: desfazer } });
    onFechar();
  }

  const mensagemErro = (e: string) => (e === "futuro" ? copy.erro.futuro : e === "antigo" ? copy.erro.antigo : e === "ordem" ? copy.sono.fimAntesDoInicio : undefined);

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.sono.titulo}>
      {confirmarAnterior && emAndamento ? (
        <div className="flex flex-col gap-3">
          <p className="tipo-corpo text-texto">{copy.sono.encerrarAnterior(formatarHora(emAndamento.inicio))}</p>
          <Botao
            largura="total"
            onClick={() => {
              encerrar(emAndamento);
              criarRegistro(bebeId, "sono", new Date(), null, {}, "timer");
              mostrar(copy.sono.iniciado);
              onFechar();
            }}
          >
            {copy.sono.encerrarEComecar}
          </Botao>
        </div>
      ) : modo === "escolha" && emAndamento && !editando ? (
        <div className="flex flex-col gap-3">
          <p className="tipo-corpo text-texto-mudo">
            {copy.tiles.dormindo} · {formatarHora(emAndamento.inicio)}
          </p>
          <Botao largura="total" tamanho="lg" onClick={() => acordou(new Date())}>
            {copy.sono.acordouAgora}
          </Botao>
          <Botao largura="total" variant="secundario" onClick={() => setModo("ajustar")}>
            {copy.sono.ajustarHora}
          </Botao>
        </div>
      ) : modo === "ajustar" && emAndamento ? (
        <div className="flex flex-col gap-4">
          <SeletorHora rotulo={copy.sono.fim} valor={fim} onChange={setFim} erro={mensagemErro(erroFim)} />
          <Botao largura="total" tamanho="lg" onClick={() => erroFim === "ok" && acordou(fim)} disabled={erroFim !== "ok"}>
            {copy.sono.salvar}
          </Botao>
        </div>
      ) : modo === "escolha" ? (
        <div className="flex flex-col gap-3">
          <Botao largura="total" tamanho="lg" onClick={comecarAgora}>
            {copy.sono.comecarAgora}
          </Botao>
          <Botao largura="total" variant="secundario" onClick={() => setModo("informar")}>
            {copy.sono.informar}
          </Botao>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <SeletorHora rotulo={copy.sono.inicio} valor={inicio} onChange={setInicio} erro={mensagemErro(erroInicio)} />
          <SeletorHora rotulo={copy.sono.fim} valor={fim} onChange={setFim} erro={mensagemErro(erroFim)} />
          <Botao largura="total" tamanho="lg" onClick={salvarInformado} disabled={erroInicio !== "ok" || erroFim !== "ok"}>
            {copy.sono.salvar}
          </Botao>
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
