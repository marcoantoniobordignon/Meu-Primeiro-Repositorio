"use client";

import { useEffect, useState } from "react";

import { bebe3dCopy as copy } from "@/copy/bebe3d";

interface Props {
  visivel: boolean;
  semana: number;
}

/** Tela de carregamento: respiro quente, coração pulsando, uma frase de cada vez. */
export function Carregando({ visivel, semana }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!visivel) return;
    const id = window.setInterval(() => setI((v) => (v + 1) % copy.carregando.frases.length), 1400);
    return () => window.clearInterval(id);
  }, [visivel]);

  return (
    <div
      aria-hidden={!visivel}
      aria-busy={visivel}
      className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-utero-fundo transition-opacity duration-700"
      style={{ opacity: visivel ? 1 : 0, background: "radial-gradient(ellipse at 50% 35%, var(--utero-rosa) -40%, var(--utero-fundo) 60%)" }}
    >
      <span aria-hidden className="anim-coracao block size-16 rounded-full bg-utero-ambar/80" />
      <p className="tipo-saudacao mt-8 text-utero-texto">{copy.carregando.titulo}</p>
      <p className="tipo-meta mt-1 text-utero-texto-mudo">{copy.semana(semana)}</p>
      <p key={i} className="anim-surge tipo-voz mt-6 text-utero-texto-mudo">
        {copy.carregando.frases[i]}
      </p>
    </div>
  );
}
