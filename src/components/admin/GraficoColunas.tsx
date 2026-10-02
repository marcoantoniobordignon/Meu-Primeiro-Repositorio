"use client";

import { useRef, useState } from "react";

import { formatarNumero, ticksRedondos } from "@/lib/admin/formato";

import { useLargura, varDaCor, type CorSerie } from "./graficos";

export interface Coluna {
  rotulo: string;
  valor: number;
  cor?: CorSerie;
  /** Destaque (ex.: "hoje"): a coluna fica cheia e as outras ficam suaves. */
  destaque?: boolean;
}

interface Props {
  itens: Coluna[];
  altura?: number;
  cor?: CorSerie;
  descricao: string;
  /** Quantos rótulos de x mostrar no máximo (o resto some sem se sobrepor). */
  maxRotulos?: number;
}

const M = { topo: 18, dir: 4, base: 24, esq: 32 };

/** Colunas de até 24 px, topo arredondado 4 px, base reta, 2 px de ar entre elas. Rótulo só no maior valor; o resto vai no hover e na tabela. */
export function GraficoColunas({ itens, altura = 160, cor = "primaria", descricao, maxRotulos = 12 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const largura = useLargura(ref);
  const [ativo, setAtivo] = useState<number | null>(null);

  const n = itens.length;
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  const ticks = ticksRedondos(maximo, 3);
  const topoEscala = ticks[ticks.length - 1]!;
  const larguraUtil = largura - M.esq - M.dir;
  const alturaUtil = altura - M.topo - M.base;
  const banda = n ? larguraUtil / n : larguraUtil;
  const espessura = Math.min(24, Math.max(3, banda - 2));
  const y = (v: number) => M.topo + alturaUtil - (v / topoEscala) * alturaUtil;
  const indiceMax = itens.reduce((m, it, i) => (it.valor > (itens[m]?.valor ?? -1) ? i : m), 0);
  const temDestaque = itens.some((i) => i.destaque);
  const passoRotulo = Math.max(1, Math.ceil(n / maxRotulos));

  function barra(i: number, v: number): string {
    const x0 = M.esq + i * banda + (banda - espessura) / 2;
    const yTopo = y(v);
    const yBase = y(0);
    const r = Math.min(4, espessura / 2, Math.max(0, yBase - yTopo));
    return `M${x0},${yBase} V${yTopo + r} Q${x0},${yTopo} ${x0 + r},${yTopo} H${x0 + espessura - r} Q${x0 + espessura},${yTopo} ${x0 + espessura},${yTopo + r} V${yBase} Z`;
  }

  return (
    <div ref={ref} className="relative w-full">
      <svg width={largura} height={altura} role="img" aria-label={descricao} onMouseLeave={() => setAtivo(null)} className="block select-none overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.esq} x2={largura - M.dir} y1={y(t)} y2={y(t)} stroke="var(--fio)" strokeWidth={1} />
            <text x={M.esq - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--texto-mudo)" style={{ fontVariantNumeric: "tabular-nums" }}>
              {formatarNumero(t)}
            </text>
          </g>
        ))}
        {itens.map((it, i) => {
          const xc = M.esq + i * banda + banda / 2;
          const apagado = temDestaque && !it.destaque;
          return (
            <g key={it.rotulo} onMouseEnter={() => setAtivo(i)}>
              <rect x={M.esq + i * banda} y={M.topo} width={banda} height={alturaUtil} fill="transparent" />
              <path d={barra(i, it.valor)} fill={varDaCor[it.cor ?? cor]} opacity={apagado ? 0.35 : ativo === i ? 0.85 : 1} />
              {(i === indiceMax || it.destaque) && it.valor > 0 && (
                <text x={xc} y={y(it.valor) - 5} textAnchor="middle" fontSize={11} fontWeight={500} fill="var(--texto)" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatarNumero(it.valor)}
                </text>
              )}
              {(i % passoRotulo === 0 || it.destaque) && (
                <text x={xc} y={altura - 7} textAnchor="middle" fontSize={11} fill={it.destaque ? "var(--texto)" : "var(--texto-mudo)"}>
                  {it.rotulo}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {ativo !== null && itens[ativo] && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 z-10 rounded-card border border-fio bg-superficie px-3 py-1.5 text-[12px] text-texto"
          style={{ left: Math.min(largura - 120, Math.max(0, M.esq + ativo * banda + banda / 2 - 40)) }}
        >
          <span className="text-texto-mudo">{itens[ativo].rotulo}</span>
          <span className="ml-2 font-medium tabular-nums">{formatarNumero(itens[ativo].valor)}</span>
        </div>
      )}
    </div>
  );
}
