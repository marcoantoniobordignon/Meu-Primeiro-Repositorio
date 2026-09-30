import type { ReactNode } from "react";

import { adminCopy as copy } from "@/copy/admin";

export interface Coluna<T> {
  chave: string;
  titulo: string;
  alinhar?: "esq" | "dir";
  render: (linha: T) => ReactNode;
}

interface Props<T> {
  colunas: Coluna<T>[];
  linhas: T[];
  chave: (linha: T) => string;
  vazio?: string;
  onLinha?: (linha: T) => void;
}

/** Tabela do painel: cabeçalho mudo, linhas finas, números alinhados à direita. */
export function Tabela<T>({ colunas, linhas, chave, vazio = copy.estados.vazio, onLinha }: Props<T>) {
  if (linhas.length === 0) return <p className="tipo-corpo px-1 py-6 text-center text-texto-mudo">{vazio}</p>;
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[520px] border-collapse text-[13px]">
        <thead>
          <tr>
            {colunas.map((c) => (
              <th key={c.chave} scope="col" className={`border-b border-fio pb-2 pr-3 text-[11px] font-medium uppercase tracking-wide text-texto-mudo ${c.alinhar === "dir" ? "text-right" : "text-left"}`}>
                {c.titulo}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr
              key={chave(l)}
              onClick={onLinha ? () => onLinha(l) : undefined}
              className={`border-b border-fio last:border-0 ${onLinha ? "cursor-pointer hover:bg-primaria-suave/50" : ""}`}
            >
              {colunas.map((c) => (
                <td key={c.chave} className={`py-2.5 pr-3 align-middle text-texto ${c.alinhar === "dir" ? "text-right tabular-nums" : ""}`}>
                  {c.render(l)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
