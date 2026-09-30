"use client";

import { Delete } from "lucide-react";

interface Props {
  valor: string;
  onChange: (v: string) => void;
  /** BEB-05: atalhos com os volumes mais usados. */
  atalhos?: number[];
  unidade?: string;
  maximo?: number;
  rotuloApagar?: string;
}

/** Teclado numérico grande para o sheet de mamadeira. */
export function Teclado({ valor, onChange, atalhos = [], unidade = "ml", maximo = 999, rotuloApagar = "Apagar" }: Props) {
  const teclas = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const digitar = (t: string) => {
    const novo = (valor === "0" ? "" : valor) + t;
    if (Number(novo) <= maximo) onChange(novo);
  };
  return (
    <div>
      <div className="flex items-baseline justify-center gap-2 py-2">
        <span className="tipo-heroi text-texto">{valor || "0"}</span>
        <span className="tipo-heroi-rotulo text-texto-mudo">{unidade}</span>
      </div>
      {atalhos.length > 0 && (
        <div className="mb-3 flex justify-center gap-2">
          {atalhos.map((a) => (
            <button key={a} type="button" onClick={() => onChange(String(a))} className="min-h-11 rounded-pilula bg-primaria-suave px-4 text-[14px] font-medium text-primaria-texto active:scale-95">
              {a} {unidade}
            </button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {teclas.slice(0, 9).map((t) => (
          <button key={t} type="button" onClick={() => digitar(t)} className="min-h-14 rounded-card bg-superficie text-[22px] font-light text-texto active:bg-primaria-suave [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
            {t}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => digitar("0")} className="min-h-14 rounded-card bg-superficie text-[22px] font-light text-texto active:bg-primaria-suave [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
          0
        </button>
        <button type="button" aria-label={rotuloApagar} onClick={() => onChange(valor.slice(0, -1))} className="grid min-h-14 place-items-center rounded-card bg-superficie text-texto-mudo active:bg-primaria-suave [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
          <Delete size={22} />
        </button>
      </div>
    </div>
  );
}
