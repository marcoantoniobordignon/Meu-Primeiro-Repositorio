"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Tema = "auto" | "claro" | "escuro";
const CHAVE = "ninho.tema";

const Ctx = createContext<{ tema: Tema; definirTema: (t: Tema) => void }>({
  tema: "auto",
  definirTema: () => {},
});

/** DS-02: data-tema no <html>; a troca não recarrega a página. */
export function ProvedorTema({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>("auto");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE) as Tema | null;
      if (salvo) setTema(salvo);
    } catch {
      /* sem storage */
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
  }, [tema]);

  const definirTema = useCallback((t: Tema) => {
    setTema(t);
    try {
      localStorage.setItem(CHAVE, t);
    } catch {
      /* sem storage */
    }
  }, []);

  return <Ctx.Provider value={{ tema, definirTema }}>{children}</Ctx.Provider>;
}

export function useTema() {
  return useContext(Ctx);
}
