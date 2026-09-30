import { formatarNumero, formatarPercentual } from "@/lib/admin/formato";

import { classeDaCor, type CorSerie } from "./graficos";

export interface ItemRanking {
  rotulo: string;
  valor: number;
  cor?: CorSerie;
}

interface Props {
  itens: ItemRanking[];
  cor?: CorSerie;
  /** Mostra a fatia do total ao lado do valor. */
  percentual?: boolean;
  vazio?: string;
}

/** Lista ordenada com barra fina: o jeito certo de comparar categorias sem ordem natural. */
export function Ranking({ itens, cor = "primaria", percentual = false, vazio }: Props) {
  const maximo = Math.max(1, ...itens.map((i) => i.valor));
  const total = itens.reduce((a, i) => a + i.valor, 0);
  if (itens.length === 0) return <p className="tipo-corpo py-4 text-center text-texto-mudo">{vazio}</p>;
  return (
    <ol className="flex flex-col gap-2.5">
      {itens.map((it) => (
        <li key={it.rotulo} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
          <span className="truncate text-[13px] text-texto">{it.rotulo}</span>
          <span className="text-[13px] font-medium tabular-nums text-texto">
            {formatarNumero(it.valor)}
            {percentual && <span className="ml-1.5 font-normal text-texto-mudo">{formatarPercentual(it.valor, total)}</span>}
          </span>
          <div className="col-span-2 h-1.5 overflow-hidden rounded-pilula bg-fio">
            <div className={`h-full rounded-pilula ${classeDaCor[it.cor ?? cor]}`} style={{ width: `${(it.valor / maximo) * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}
