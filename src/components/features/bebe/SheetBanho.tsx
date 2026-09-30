"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { SeletorHora } from "@/components/ui/SeletorHora";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { bebeCopy as copy } from "@/copy/bebe";
import { arredondar5min, validarInicio } from "@/lib/bebe/registros";
import type { RegistroBebe } from "@/lib/dados/colecoes";

import { apagarRegistro, atualizarRegistro, criarRegistro } from "./acoes";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  bebeId: string;
  registro?: RegistroBebe | null;
}

/** Sheet "Banho": registrar agora ou ajustar a hora. */
export function SheetBanho({ aberto, onFechar, bebeId, registro }: Props) {
  const [quando, setQuando] = useState(() => arredondar5min(new Date()));
  const [ajustando, setAjustando] = useState(false);
  const { mostrar } = useToast();

  useEffect(() => {
    if (!aberto) return;
    setAjustando(Boolean(registro));
    setQuando(registro ? new Date(registro.inicio) : arredondar5min(new Date()));
  }, [aberto, registro]);

  const erro = validarInicio(quando);

  function salvar(d: Date) {
    if (registro) atualizarRegistro(registro, { inicio: d.toISOString(), fim: d.toISOString() }, "horario");
    else criarRegistro(bebeId, "banho", d, d, {});
    mostrar(copy.banho.registrado);
    onFechar();
  }

  return (
    <Sheet aberto={aberto} onFechar={onFechar} titulo={copy.banho.titulo}>
      <div className="flex flex-col gap-3">
        {!ajustando ? (
          <>
            <Botao largura="total" tamanho="lg" onClick={() => salvar(new Date())}>
              {copy.banho.agora}
            </Botao>
            <Botao largura="total" variant="secundario" onClick={() => setAjustando(true)}>
              {copy.sono.ajustarHora}
            </Botao>
          </>
        ) : (
          <>
            <SeletorHora rotulo={copy.banho.quando} valor={quando} onChange={setQuando} erro={erro === "futuro" ? copy.erro.futuro : erro === "antigo" ? copy.erro.antigo : undefined} />
            <Botao largura="total" tamanho="lg" onClick={() => erro === "ok" && salvar(quando)} disabled={erro !== "ok"}>
              {copy.banho.salvar}
            </Botao>
          </>
        )}
        {registro && (
          <Botao
            largura="total"
            variant="fantasma"
            onClick={() => {
              const desfazer = apagarRegistro(registro);
              mostrar(copy.apagado(copy.tiles.banho), { acao: { rotulo: copy.desfazer, onClick: desfazer } });
              onFechar();
            }}
          >
            {copy.apagar}
          </Botao>
        )}
      </div>
    </Sheet>
  );
}
