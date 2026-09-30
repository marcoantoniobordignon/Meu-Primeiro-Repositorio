"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

interface ToastAtual {
  id: number;
  texto: string;
}

const Ctx = createContext<{ mostrar: (texto: string) => void }>({ mostrar: () => {} });

/** Toast: uma linha, 3 s, no topo, para confirmações. Nunca modal. */
export function ProvedorToast({ children }: { children: ReactNode }) {
  const [atual, setAtual] = useState<ToastAtual | null>(null);
  const [visivel, setVisivel] = useState(false);
  const timer = useRef<number | null>(null);

  const mostrar = useCallback((texto: string) => {
    if (timer.current) window.clearTimeout(timer.current);
    setAtual({ id: Date.now(), texto });
    setVisivel(true);
    timer.current = window.setTimeout(() => setVisivel(false), 3000);
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
            className="mt-[calc(env(safe-area-inset-top,0px)+12px)] rounded-pilula bg-texto px-4 py-2.5 text-[14px] font-medium text-fundo transition-[opacity,transform]"
            style={{
              opacity: visivel ? 1 : 0,
              transform: visivel ? "translateY(0)" : "translateY(-8px)",
              transitionDuration: "var(--anim-toast)",
            }}
          >
            {atual.texto}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
