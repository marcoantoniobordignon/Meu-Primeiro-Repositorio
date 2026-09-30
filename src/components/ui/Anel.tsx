"use client";

import { useEffect, useId, useState } from "react";

interface Props {
  /** Valor máximo (ex.: 40 semanas). */
  total: number;
  /** Valor atual (ex.: 22.4). */
  atual: number;
  /** Marcas de trimestre, em unidades de `total`. */
  segmentos?: number[];
  tamanho?: number;
  children?: React.ReactNode;
  rotulo: string;
}

const TRACO = 12;

/**
 * Anel SVG: trilho --fio, progresso teal, marcador do dia branco com borda coral.
 * Anima 600 ms ao montar; com prefers-reduced-motion aparece já preenchido (DS-05).
 */
export function Anel({ total, atual, segmentos = [], tamanho = 200, children, rotulo }: Props) {
  const id = useId();
  const [montado, setMontado] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMontado(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const raio = (tamanho - TRACO) / 2;
  const centro = tamanho / 2;
  const circ = 2 * Math.PI * raio;
  const fracao = Math.max(0, Math.min(1, atual / total));
  const fracaoAnimada = montado ? fracao : 0;

  // Marcador na ponta do progresso; ângulo começa no topo (-90°).
  const ang = -Math.PI / 2 + fracaoAnimada * 2 * Math.PI;
  const mx = centro + raio * Math.cos(ang);
  const my = centro + raio * Math.sin(ang);

  return (
    <div className="relative" style={{ width: tamanho, height: tamanho }}>
      <svg
        width={tamanho}
        height={tamanho}
        viewBox={`0 0 ${tamanho} ${tamanho}`}
        role="img"
        aria-labelledby={id}
      >
        <title id={id}>{rotulo}</title>
        <circle cx={centro} cy={centro} r={raio} fill="none" stroke="var(--fio)" strokeWidth={TRACO} />
        {segmentos.map((s) => {
          const a = -Math.PI / 2 + (s / total) * 2 * Math.PI;
          const x1 = centro + (raio - TRACO / 2) * Math.cos(a);
          const y1 = centro + (raio - TRACO / 2) * Math.sin(a);
          const x2 = centro + (raio + TRACO / 2) * Math.cos(a);
          const y2 = centro + (raio + TRACO / 2) * Math.sin(a);
          return (
            <line key={s} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fundo)" strokeWidth={3} />
          );
        })}
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="var(--cor-primaria)"
          strokeWidth={TRACO}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - fracaoAnimada)}
          transform={`rotate(-90 ${centro} ${centro})`}
          style={{ transition: `stroke-dashoffset var(--anim-anel) cubic-bezier(0.2, 0.8, 0.2, 1)` }}
        />
        <circle
          cx={mx}
          cy={my}
          r={8}
          fill="var(--superficie)"
          stroke="var(--cor-acento)"
          strokeWidth={3}
          style={{ transition: `cx var(--anim-anel), cy var(--anim-anel)` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}
