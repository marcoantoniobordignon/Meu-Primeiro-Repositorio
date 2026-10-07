"use client";

interface Props {
  rotulo: string;
  apoio?: string;
  ligado: boolean;
  onMudar: (ligado: boolean) => void;
  desativado?: boolean;
}

/** Linha com interruptor: rótulo, apoio opcional e a chave à direita. Toda a linha é o alvo (≥ 44 px). */
export function Interruptor({ rotulo, apoio, ligado, onMudar, desativado = false }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={desativado}
      onClick={() => onMudar(!ligado)}
      className="flex min-h-11 w-full items-center gap-3 py-1 text-left disabled:opacity-45"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-texto">{rotulo}</span>
        {apoio && <span className="tipo-meta block">{apoio}</span>}
      </span>
      <span aria-hidden className={`relative h-7 w-12 shrink-0 rounded-pilula transition-colors ${ligado ? "bg-primaria" : "bg-fio"}`}>
        <span className={`absolute left-0 top-1 size-5 rounded-full bg-superficie transition-transform ${ligado ? "translate-x-6" : "translate-x-1"}`} />
      </span>
    </button>
  );
}
