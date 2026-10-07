"use client";

interface Props<T extends string | number> {
  rotulo: string;
  opcoes: { valor: T; rotulo: string; rotuloLongo?: string }[];
  valor: T;
  onMudar: (valor: T) => void;
}

/** Abas em pílula (tablist): alvo de 44 px, a selecionada em superfície. */
export function Abas<T extends string | number>({ rotulo, opcoes, valor, onMudar }: Props<T>) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex rounded-pilula bg-primaria-suave p-1">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          aria-label={o.rotuloLongo}
          onClick={() => onMudar(o.valor)}
          className={`min-h-11 flex-1 rounded-pilula text-[14px] font-medium text-primaria-texto ${valor === o.valor ? "bg-superficie" : ""}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
