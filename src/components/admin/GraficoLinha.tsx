"use client";

import { useRef, useState } from "react";

import { formatarNumero, ticksRedondos } from "@/lib/admin/formato";

import { classeDaCor, useLargura, varDaCor, type CorSerie } from "./graficos";

export interface Serie {
  nome: string;
  cor: CorSerie;
  valores: number[];
}

interface Props {
  rotulos: string[];
  series: Serie[];
  formatarRotulo: (rotulo: string) => string;
  altura?: number;
  descricao: string;
}

const M = { topo: 12, dir: 12, base: 26, esq: 36 };

/**
 * Linha de 2 px, área a 10 %, ponto final marcado, grade em hairline.
 * Hover: crosshair e tooltip com todas as séries. Legenda quando há 2+.
 */
export function GraficoLinha({ rotulos, series, formatarRotulo, altura = 180, descricao }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const largura = useLargura(ref);
  const [indice, setIndice] = useState<number | null>(null);

  const n = rotulos.length;
  const maximo = Math.max(1, ...series.flatMap((s) => s.valores));
  const ticks = ticksRedondos(maximo);
  const topoEscala = ticks[ticks.length - 1]!;
  const larguraUtil = largura - M.esq - M.dir;
  const alturaUtil = altura - M.topo - M.base;
  const x = (i: number) => M.esq + (n <= 1 ? larguraUtil / 2 : (i / (n - 1)) * larguraUtil);
  const y = (v: number) => M.topo + alturaUtil - (v / topoEscala) * alturaUtil;

  function caminho(valores: number[]): string {
    return valores.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  }

  function aoMover(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - M.esq) / larguraUtil) * (n - 1));
    setIndice(Math.max(0, Math.min(n - 1, i)));
  }

  const passoRotulo = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(larguraUtil / 64))));
  const ativo = indice !== null ? indice : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={largura}
        height={altura}
        role="img"
        aria-label={descricao}
        onMouseMove={aoMover}
        onMouseLeave={() => setIndice(null)}
        className="block select-none overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.esq} x2={largura - M.dir} y1={y(t)} y2={y(t)} stroke="var(--fio)" strokeWidth={1} />
            <text x={M.esq - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--texto-mudo)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarNumero(t)}
            </text>
          </g>
        ))}
        {rotulos.map((r, i) =>
          i % passoRotulo === 0 || i === n - 1 ? (
            <text key={r} x={x(i)} y={altura - 8} textAnchor={i === n - 1 ? "end" : i === 0 ? "start" : "middle"} fontSize={11} fill="var(--texto-mudo)">
              {formatarRotulo(r)}
            </text>
          ) : null,
        )}
        {series.map((s) => (
          <g key={s.nome}>
            <path d={`${caminho(s.valores)} L${x(n - 1).toFixed(1)},${y(0).toFixed(1)} L${x(0).toFixed(1)},${y(0).toFixed(1)} Z`} fill={varDaCor[s.cor]} opacity={0.1} />
            <path d={caminho(s.valores)} fill="none" stroke={varDaCor[s.cor]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(n - 1)} cy={y(s.valores[n - 1] ?? 0)} r={4} fill={varDaCor[s.cor]} stroke="var(--superficie)" strokeWidth={2} />
          </g>
        ))}
        {ativo !== null && (
          <g>
            <line x1={x(ativo)} x2={x(ativo)} y1={M.topo} y2={M.topo + alturaUtil} stroke="var(--texto-mudo)" strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.nome} cx={x(ativo)} cy={y(s.valores[ativo] ?? 0)} r={4} fill={varDaCor[s.cor]} stroke="var(--superficie)" strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {ativo !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 rounded-card border border-fio bg-superficie px-3 py-2 text-[12px] text-texto"
          style={{ left: Math.min(largura - 150, Math.max(0, x(ativo) - 60)) }}
        >
          <div className="tipo-meta">{formatarRotulo(rotulos[ativo] ?? "")}</div>
          {series.map((s) => (
            <div key={s.nome} className="mt-0.5 flex items-center gap-2">
              <span aria-hidden className={`size-2 rounded-full ${classeDaCor[s.cor]}`} />
              <span className="text-texto-mudo">{s.nome}</span>
              <span className="ml-auto pl-3 font-medium tabular-nums">{formatarNumero(s.valores[ativo] ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      {series.length > 1 && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1" aria-label="Legenda">
          {series.map((s) => (
            <li key={s.nome} className="flex items-center gap-1.5 text-[12px] text-texto-mudo">
              <span aria-hidden className={`h-0.5 w-4 rounded-pilula ${classeDaCor[s.cor]}`} />
              {s.nome}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
