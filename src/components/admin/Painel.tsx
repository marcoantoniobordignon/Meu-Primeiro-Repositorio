"use client";

import { Table2, ChartColumn } from "lucide-react";
import { useState, type ReactNode } from "react";

import { adminCopy as copy } from "@/copy/admin";

interface Props {
  titulo: string;
  apoio?: string;
  acao?: ReactNode;
  children: ReactNode;
  /** Versão em tabela do mesmo dado: todo gráfico tem uma (acessibilidade). */
  tabela?: ReactNode;
  carregando?: boolean;
}

/** Card de painel: título, apoio, ação à direita e alternância gráfico/tabela. */
export function Painel({ titulo, apoio, acao, children, tabela, carregando = false }: Props) {
  const [verTabela, setVerTabela] = useState(false);
  return (
    <section className="flex min-w-0 flex-col rounded-card border border-transparent bg-superficie px-4 py-3.5 [[data-tema=escuro]_&]:border-fio">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="tipo-saudacao text-texto">{titulo}</h2>
          {apoio && <p className="tipo-meta mt-0.5">{apoio}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {acao}
          {tabela && (
            <button
              type="button"
              onClick={() => setVerTabela((v) => !v)}
              aria-pressed={verTabela}
              aria-label={verTabela ? copy.estados.grafico : copy.estados.tabela}
              title={verTabela ? copy.estados.grafico : copy.estados.tabela}
              className="grid size-9 place-items-center rounded-pilula text-texto-mudo hover:bg-primaria-suave hover:text-primaria-texto"
            >
              {verTabela ? <ChartColumn size={16} /> : <Table2 size={16} />}
            </button>
          )}
        </div>
      </header>
      <div className={`mt-3 min-w-0 flex-1 transition-opacity ${carregando ? "opacity-50" : ""}`}>{verTabela && tabela ? tabela : children}</div>
    </section>
  );
}
