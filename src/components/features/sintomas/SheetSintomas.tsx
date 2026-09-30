"use client";

import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { sintomasCopy as copy } from "@/copy/sintomas";
import { useColecao } from "@/lib/dados/colecao";
import { sintomas as colecao } from "@/lib/dados/colecoes";
import { paraISO, rotuloDia, type DataISO } from "@/lib/dates";
import { catalogo, corDoGrupo, ordemGrupos, type Especial } from "@/lib/sintomas/catalogo";
import { diaEditavel, nomeIntensidade, proximaIntensidade, registrosDoDia, type Intensidade } from "@/lib/sintomas/regras";

import { definirIntensidade, definirNotaDoDia, notaDoDia } from "./acoes";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Dia sendo editado; padrão hoje. */
  data?: DataISO;
  onEspecial?: (especial: Especial) => void;
}

const cores = {
  primaria: "bg-primaria",
  fralda: "bg-fralda",
  acento: "bg-acento",
  sono: "bg-sono",
  banho: "bg-banho",
};

/** SIN-03: todos os sintomas por grupo; tocar cicla leve → incômodo → forte → remove. */
export function SheetSintomas({ aberto, onFechar, data, onEspecial }: Props) {
  const hoje = paraISO(new Date());
  const dia = data ?? hoje;
  const editavel = diaEditavel(dia, hoje);
  const todos = useColecao(colecao);
  const doDia = registrosDoDia(todos, dia);
  const intensidadeDe = new Map(doDia.map((s) => [s.slug, s.intensidade as Intensidade]));
  const [nota, setNota] = useState("");
  const { mostrar } = useToast();

  useEffect(() => {
    if (aberto) setNota(notaDoDia(registrosDoDia(colecao.listar(), dia)));
  }, [aberto, dia]);

  function salvar() {
    if (editavel) definirNotaDoDia(dia, nota.trim());
    mostrar(copy.salvo);
    onFechar();
  }

  return (
    <Sheet
      aberto={aberto}
      onFechar={onFechar}
      titulo={dia === hoje ? copy.sheetTitulo : copy.sheetTituloDia(rotuloDia(dia, hoje))}
      rodape={
        <Botao largura="total" tamanho="lg" onClick={salvar}>
          {copy.salvar}
        </Botao>
      }
    >
      <p className="tipo-meta">{editavel ? copy.ajudaIntensidade : copy.somenteLeitura}</p>
      <div className="mt-4 flex flex-col gap-5">
        {ordemGrupos.map((grupo) => (
          <section key={grupo}>
            <h3 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.grupos[grupo]}</h3>
            <div className="flex flex-wrap gap-2">
              {catalogo
                .filter((i) => i.grupo === grupo)
                .map((item) => {
                  const atual = intensidadeDe.get(item.slug) ?? null;
                  const ligado = atual !== null;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      disabled={!editavel && !item.especial}
                      aria-pressed={ligado}
                      onClick={() => {
                        if (item.especial) return onEspecial?.(item.especial);
                        definirIntensidade(item.slug, dia, proximaIntensidade(atual), "sheet");
                      }}
                      className={
                        "inline-flex min-h-11 items-center gap-2 rounded-pilula border px-3.5 text-[14px] font-medium transition-colors active:scale-[0.97] disabled:opacity-45 " +
                        (ligado ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto")
                      }
                    >
                      <span aria-hidden className={`flex h-[18px] items-center gap-0.5 rounded-full px-1 ${ligado ? "bg-acento" : cores[corDoGrupo[item.grupo]]}`}>
                        {ligado ? (
                          Array.from({ length: 3 }, (_, i) => (
                            <span key={i} className={`size-1.5 rounded-full ${i < (atual ?? 0) ? "bg-white" : "bg-white/35"}`} />
                          ))
                        ) : (
                          <span className="size-2.5" />
                        )}
                      </span>
                      {item.nome}
                      {ligado && <span className="tipo-meta text-texto-mudo">· {nomeIntensidade[atual]}</span>}
                    </button>
                  );
                })}
            </div>
          </section>
        ))}

        <label className="block">
          <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{copy.nota}</span>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            disabled={!editavel}
            rows={2}
            maxLength={280}
            placeholder={copy.notaPlaceholder}
            className="block w-full resize-none rounded-card border border-fio bg-superficie px-4 py-3 text-[16px] text-texto placeholder:text-texto-mudo/70 focus:outline-none focus:ring-2 focus:ring-primaria disabled:opacity-45"
          />
        </label>
      </div>
    </Sheet>
  );
}
