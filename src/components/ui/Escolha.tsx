"use client";

interface Opcao<T extends string | number> {
  valor: T;
  rotulo: string;
}

interface Props<T extends string | number> {
  rotulo: string;
  opcoes: Opcao<T>[];
  /** Um valor (radio) ou vários (checkbox). */
  valor: T | T[];
  onMudar: (valor: T) => void;
  /** Esconde o rótulo visível (fica só para o leitor de tela). */
  semRotulo?: boolean;
}

/** Pílulas de escolha: uma (radio) ou várias (checkbox). Selecionada em coral, como o Chip (spec 02). */
export function Escolha<T extends string | number>({ rotulo, opcoes, valor, onMudar, semRotulo = false }: Props<T>) {
  const multipla = Array.isArray(valor);
  const marcado = (v: T) => (multipla ? (valor as T[]).includes(v) : valor === v);
  return (
    <div>
      {!semRotulo && <span className="tipo-titulo-secao mb-1.5 block text-texto-mudo">{rotulo}</span>}
      <div role={multipla ? "group" : "radiogroup"} aria-label={rotulo} className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <button
            key={String(o.valor)}
            type="button"
            role={multipla ? "checkbox" : "radio"}
            aria-checked={marcado(o.valor)}
            onClick={() => onMudar(o.valor)}
            className={`min-h-11 min-w-11 rounded-pilula border px-4 text-[14px] font-medium ${
              marcado(o.valor) ? "border-acento bg-acento-suave text-texto" : "border-fio bg-superficie text-texto"
            }`}
          >
            {o.rotulo}
          </button>
        ))}
      </div>
    </div>
  );
}
