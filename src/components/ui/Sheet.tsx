"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo?: string;
  children: ReactNode;
  /** Rodapé fixo (CTA) abaixo do conteúdo rolável. */
  rodape?: ReactNode;
  rotuloFechar?: string;
}

/**
 * Bottom sheet: alça, raio 24 no topo, fecha por arraste, botão e Escape.
 * Entrada de 240 ms (DS-05); com "reduzir movimento", instantâneo.
 */
export function Sheet({ aberto, onFechar, titulo, children, rodape, rotuloFechar = "Fechar" }: Props) {
  const [montado, setMontado] = useState(aberto);
  const [visivel, setVisivel] = useState(false);
  const [arraste, setArraste] = useState(0);
  const inicioY = useRef<number | null>(null);
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberto) {
      setMontado(true);
      const raf = requestAnimationFrame(() => setVisivel(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisivel(false);
    const t = window.setTimeout(() => setMontado(false), 240);
    return () => window.clearTimeout(t);
  }, [aberto]);

  useEffect(() => {
    if (!montado) return;
    const antes = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", aoTeclar);
    painel.current?.focus();
    return () => {
      document.documentElement.style.overflow = antes;
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [montado, onFechar]);

  if (!montado) return null;

  return (
    <div className="fixed inset-0 z-40" role="presentation">
      <button
        type="button"
        aria-label={rotuloFechar}
        onClick={onFechar}
        className="absolute inset-0 bg-texto/40 transition-opacity"
        style={{ opacity: visivel ? 1 : 0, transitionDuration: "var(--anim-sheet)" }}
      />
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] w-full max-w-md flex-col rounded-t-[24px] bg-superficie outline-none"
        style={{
          transform: visivel ? `translateY(${arraste}px)` : "translateY(100%)",
          transition: inicioY.current === null ? `transform var(--anim-sheet) cubic-bezier(0.2, 0.8, 0.2, 1)` : "none",
        }}
        onPointerDown={(e) => {
          // Só arrasta a partir da área da alça/título, para não brigar com a rolagem do conteúdo.
          if ((e.target as HTMLElement).closest("[data-alca]")) {
            inicioY.current = e.clientY;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          if (inicioY.current === null) return;
          setArraste(Math.max(0, e.clientY - inicioY.current));
        }}
        onPointerUp={() => {
          if (inicioY.current === null) return;
          const fechar = arraste > 90;
          inicioY.current = null;
          setArraste(0);
          if (fechar) onFechar();
        }}
      >
        <div data-alca className="shrink-0 cursor-grab touch-none px-5 pb-2 pt-3">
          <div aria-hidden className="mx-auto h-1.5 w-10 rounded-pilula bg-fio" />
          <div className="mt-3 flex min-h-11 items-center justify-between">
            {titulo && <h2 className="tipo-saudacao text-texto">{titulo}</h2>}
            <button
              type="button"
              onClick={onFechar}
              aria-label={rotuloFechar}
              className="-mr-2 grid size-11 place-items-center rounded-pilula text-texto-mudo active:bg-primaria-suave"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {rodape && <div className="safe-bottom shrink-0 border-t border-fio px-5 pt-3">{rodape}</div>}
      </div>
    </div>
  );
}
