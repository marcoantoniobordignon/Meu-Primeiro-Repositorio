import { formatarNumero, formatarVariacao } from "@/lib/admin/formato";

interface Props {
  rotulo: string;
  valor: number | string | null | undefined;
  /** Variação em % contra o período anterior; a cor segue a direção. */
  delta?: number | null;
  apoio?: string;
  carregando?: boolean;
}

/** Stat tile: rótulo, número grande na mesma fonte de tudo, delta e uma linha de apoio. */
export function Indicador({ rotulo, valor, delta, apoio, carregando = false }: Props) {
  const texto = typeof valor === "number" ? formatarNumero(valor) : (valor ?? "–");
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-card border border-transparent bg-superficie px-4 py-3.5 [[data-tema=escuro]_&]:border-fio">
      <span className="tipo-titulo-secao text-texto-mudo">{rotulo}</span>
      <div className={carregando ? "opacity-50 transition-opacity" : "transition-opacity"}>
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-light leading-none tracking-[-0.02em] text-texto">{texto}</span>
          {delta !== undefined && delta !== null && (
            <span className={`text-[12px] font-medium ${delta >= 0 ? "text-sucesso" : "text-erro"}`}>{formatarVariacao(delta)}</span>
          )}
        </div>
        {apoio && <span className="tipo-meta mt-1 block">{apoio}</span>}
      </div>
    </div>
  );
}
