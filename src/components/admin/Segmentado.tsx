"use client";

interface Opcao<T extends string> {
  valor: T;
  rotulo: string;
}

interface Props<T extends string> {
  rotulo: string;
  opcoes: Opcao<T>[];
  valor: T;
  onMudar: (v: T) => void;
}

/** Controle segmentado: um filtro por linha, acima do que ele filtra. */
export function Segmentado<T extends string>({ rotulo, opcoes, valor, onMudar }: Props<T>) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="inline-flex rounded-pilula border border-fio bg-superficie p-0.5">
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => onMudar(o.valor)}
            className={`min-h-9 rounded-pilula px-3.5 text-[13px] font-medium transition-colors ${ativo ? "bg-primaria-suave text-primaria-texto" : "text-texto-mudo hover:text-texto"}`}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
