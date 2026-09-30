"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface Opcoes {
  /** BEB-09: ação inline, como "desfazer". */
  acao?: { rotulo: string; onClick: () => void };
  duracaoMs?: number;
}

interface ToastAtual extends Opcoes {
  id: number;
  texto: string;
}

const Ctx = createContext<{ mostrar: (texto: string, opcoes?: Opcoes) => void }>({ mostrar: () => {} });

/** Toast: uma linha, 3 s (5 s com ação), no topo, para confirmações. Nunca modal. */
export function ProvedorToast({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState<ToastAtual | null>(null);
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<number | null>(null);

  const mostrar = useCallback((texto: string, opcoes: Opcoes = {}) => {
    if (timer.current) window.clearTimeout(timer.current);
    setAtual({ id: Date.now(), texto, ...opcoes });
    setVisivel(true);
    timer.current = window.setTimeout(() => setVisivel(false), opcoes.duracaoMs ?? (opcoes.acao ? 5000 : 3000));
  }, []);

  useEffect(() => {
    if (visivel || !atual) return;
    const t = window.setTimeout(() => setAtual(null), 200);
    return () => window.clearTimeout(t);
  }, [visivel, atual]);

  return (
    <Ctx.Provider value={{ mostrar }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4">
        {atual && (
          <div
            key={atual.id}
            role="status"
            className="pointer-events-auto mt-[calc(env(safe-area-inset-top,0px)+12px)] flex items-center gap-3 rounded-pilula bg-texto py-2.5 pl-4 pr-2 text-[14px] font-medium text-fundo transition-[opacity,transform]"
            style={{
              opacity: visivel ? 1 : 0,
              transform: visivel ? "translateY(0)" : "translateY(-8px)",
              transitionDuration: "var(--anim-toast)",
            }}
          >
            <span className={atual.acao ? "" : "pr-2"}>{atual.texto}</span>
            {atual.acao && (
              <button
                type="button"
                onClick={() => {
                  atual.acao?.onClick();
                  setVisivel(false);
                }}
                className="min-h-8 rounded-pilula bg-fundo/15 px-3 text-primaria"
              >
                {atual.acao.rotulo}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
