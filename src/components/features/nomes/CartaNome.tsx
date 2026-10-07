"use client";

import { useRef, useState } from "react";

import { nomesCopy as copy } from "@/copy/nomes";
import type { NomeRemoto } from "@/lib/dados/colecoes";
import { significadoVisivel } from "@/lib/nomes/catalogo";
import { diaDoSanto } from "@dominio/fe.ts";
import { popularidade, santoDoNome } from "@dominio/nomes.ts";

const LIMIAR = 90;

interface Props {
  nome: NomeRemoto;
  comServidor: boolean;
  modoFe: boolean;
  mostrarPopularidade: boolean;
  onVotar: (vote: "like" | "dislike") => void;
  onAbrir: () => void;
}

/**
 * RN-02: arrastar para a direita curte, para a esquerda descarta, tocar abre o detalhe. Os botões da tela fazem
 * o mesmo (acessibilidade); a carta é um botão que abre o detalhe.
 */
export function CartaNome({ nome, comServidor, modoFe, mostrarPopularidade, onVotar, onAbrir }: Props) {
  const [dx, setDx] = useState(0);
  const inicio = useRef<{ x: number; id: number } | null>(null);
  const arrastou = useRef(false);
  const s = significadoVisivel(nome, comServidor);
  const santo = santoDoNome(nome, modoFe);

  return (
    <button
      type="button"
      aria-label={copy.abrirDetalhe(nome.name)}
      data-carta-nome={nome.name}
      onPointerDown={(e) => {
        inicio.current = { x: e.clientX, id: e.pointerId };
        arrastou.current = false;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!inicio.current || inicio.current.id !== e.pointerId) return;
        const d = e.clientX - inicio.current.x;
        if (Math.abs(d) > 6) arrastou.current = true;
        setDx(d);
      }}
      onPointerUp={() => {
        const d = dx;
        inicio.current = null;
        setDx(0);
        if (d > LIMIAR) onVotar("like");
        else if (d < -LIMIAR) onVotar("dislike");
      }}
      onPointerCancel={() => {
        inicio.current = null;
        setDx(0);
      }}
      onClick={() => {
        if (!arrastou.current) onAbrir();
      }}
      style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)`, touchAction: "pan-y" }}
      className={`relative flex min-h-80 w-full flex-col items-center justify-center gap-3 rounded-card border-2 bg-superficie px-6 py-8 text-center transition-[border-color] ${
        dx > LIMIAR / 2 ? "border-sucesso" : dx < -LIMIAR / 2 ? "border-acento" : "border-transparent [[data-tema=escuro]_&]:border-fio"
      } ${dx === 0 ? "transition-transform duration-200" : ""}`}
    >
      <span className="font-serifa text-[44px] leading-tight text-texto">{nome.name}</span>
      <span className="tipo-corpo text-texto">{s.meaning ?? copy.significadoEmBreve}</span>
      <span className="flex flex-wrap justify-center gap-2">
        {s.origin && <span className="rounded-pilula bg-primaria-suave px-2.5 py-0.5 text-[12px] font-medium text-primaria-texto">{copy.origemDe(s.origin)}</span>}
        {mostrarPopularidade && <span className="rounded-pilula bg-primaria-suave px-2.5 py-0.5 text-[12px] font-medium text-primaria-texto">{copy.popularidade[popularidade(nome)]}</span>}
        {s.rascunho && s.meaning && <span className="rounded-pilula bg-acento-suave px-2.5 py-0.5 text-[12px] font-medium text-texto">{copy.rascunho}</span>}
      </span>
      {santo && <span className="tipo-meta">{copy.santo(santo.nome, diaDoSanto(santo.dia))}</span>}
    </button>
  );
}

