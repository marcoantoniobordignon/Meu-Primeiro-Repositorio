"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { adminCopy as copy } from "@/copy/admin";
import { nomeCategoria, type Categoria, type CorToken } from "@/lib/conteudo/banco";
import { blocos, type Trecho } from "@/lib/conteudo/markdown";

interface Props {
  titulo: string;
  categoria: Categoria;
  cor: CorToken;
  cards: string[];
}

const tinta: Record<CorToken, string> = {
  primaria: "bg-primaria/10",
  acento: "bg-acento/10",
  banho: "bg-banho/12",
  fralda: "bg-fralda/14",
  sono: "bg-sono/10",
  mamada: "bg-mamada/10",
};

const bolinha: Record<CorToken, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sono: "bg-sono",
  mamada: "bg-mamada",
};

/** A story como a mãe vê: mesma tinta, mesma progressão, um card por vez, num celular de mentira. */
export function PreviewStory({ titulo, categoria, cor, cards }: Props) {
  const [i, setI] = useState(0);
  const total = Math.max(1, cards.length);
  useEffect(() => {
    if (i > total - 1) setI(total - 1);
  }, [i, total]);
  const card = cards[i] ?? "";

  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className={`flex aspect-[9/17] flex-col rounded-[28px] border-[6px] border-texto/85 ${tinta[cor]} bg-fundo px-4 pb-4 pt-4`}>
        <div className="flex gap-1">
          {Array.from({ length: total }, (_, k) => (
            <span key={k} className={`h-1 flex-1 rounded-pilula ${k <= i ? bolinha[cor] : "bg-texto/15"}`} />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <span aria-hidden className={`size-2 rounded-full ${bolinha[cor]}`} />
          <span className="text-[11px] font-medium text-texto-mudo">{nomeCategoria[categoria]}</span>
        </div>
        <p className="mt-3 text-[12px] font-medium text-texto-mudo">{titulo || "…"}</p>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-3">
            {blocos(card).map((b, k) =>
              b.tipo === "lista" ? (
                <ul key={k} className="flex flex-col gap-1.5">
                  {b.itens.map((item, j) => (
                    <li key={j} className="flex gap-2 text-[14px] leading-[1.4] text-texto">
                      <span aria-hidden className="mt-[8px] size-1 shrink-0 rounded-full bg-texto-mudo" />
                      <span>{render(item)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p key={k} className={`text-texto ${soEmoji(b.trechos) ? "text-[40px] leading-none" : "text-[16px] leading-[1.35]"}`}>
                  {render(b.trechos)}
                </p>
              ),
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" aria-label="Card anterior" onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0} className="grid size-9 place-items-center rounded-pilula text-texto disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <span className="tipo-meta">{copy.conteudo.editor.cardDe(i + 1, total)}</span>
          <button type="button" aria-label="Próximo card" onClick={() => setI((v) => Math.min(total - 1, v + 1))} disabled={i >= total - 1} className="grid size-9 place-items-center rounded-pilula text-texto disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

function soEmoji(t: Trecho[]): boolean {
  const texto = t.map((x) => x.valor).join("").trim();
  return texto.length <= 4 && /\p{Extended_Pictographic}/u.test(texto);
}

function render(t: Trecho[]) {
  return t.map((x, k) =>
    x.tipo === "negrito" ? (
      <strong key={k} className="font-medium">
        {x.valor}
      </strong>
    ) : x.tipo === "italico" ? (
      <em key={k} className="font-serifa">
        {x.valor}
      </em>
    ) : (
      <span key={k}>{x.valor}</span>
    ),
  );
}
