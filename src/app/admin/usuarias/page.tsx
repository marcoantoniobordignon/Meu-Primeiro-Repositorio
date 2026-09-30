"use client";

import { useState } from "react";

import { Erro, EsqueletoGrafico, EsqueletoLinhas } from "@/components/admin/Estado";
import { GraficoColunas } from "@/components/admin/GraficoColunas";
import { Painel } from "@/components/admin/Painel";
import { Ranking } from "@/components/admin/Ranking";
import { Tabela } from "@/components/admin/Tabela";
import { Titulo } from "@/components/admin/Titulo";
import { Botao } from "@/components/ui/Botao";
import { adminCopy as copy } from "@/copy/admin";
import { useDados } from "@/lib/admin/fonte";
import { formatarDataHora, formatarNumero, formatarRelativo } from "@/lib/admin/formato";
import type { Contagem, FamiliaResumo } from "@/lib/admin/tipos";

const u = copy.usuarias;
const POR_PAGINA = 25;

export default function PaginaUsuarias() {
  const dist = useDados((f) => f.distribuicoes());
  const [paginas, setPaginas] = useState(1);
  const familias = useDados(async (f) => {
    const todas: FamiliaResumo[] = [];
    for (let p = 0; p < paginas; p++) todas.push(...(await f.familias(POR_PAGINA, p * POR_PAGINA)));
    return todas;
  }, [paginas]);

  const semanas = completar(dist.dados?.semanas ?? [], 1, 42);
  const meses = completar(dist.dados?.meses_bebe ?? [], 0, 12);

  return (
    <div>
      <Titulo titulo={u.titulo} apoio={u.apoio} />
      {dist.erro && (
        <div className="mb-4">
          <Erro mensagem={dist.erro} onTentar={dist.recarregar} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo={u.semanasTitulo} apoio={u.semanasApoio} carregando={dist.carregando} tabela={<TabelaContagem itens={semanas} prefixo="Semana" />}>
          {dist.dados ? <GraficoColunas descricao={u.semanasTitulo} itens={semanas.map((s) => ({ rotulo: s.chave, valor: s.n }))} maxRotulos={14} /> : <EsqueletoGrafico altura={160} />}
        </Painel>
        <Painel titulo={u.mesesTitulo} apoio={u.mesesApoio} carregando={dist.carregando} tabela={<TabelaContagem itens={meses} prefixo="Mês" />}>
          {dist.dados ? <GraficoColunas descricao={u.mesesTitulo} cor="banho" itens={meses.map((s) => ({ rotulo: s.chave, valor: s.n }))} maxRotulos={13} /> : <EsqueletoGrafico altura={160} />}
        </Painel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Painel titulo={u.papeisTitulo} apoio={u.papeisApoio} carregando={dist.carregando}>
          {dist.dados ? <Ranking percentual itens={dist.dados.papeis.map((p) => ({ rotulo: u.papelNome[p.chave] ?? p.chave, valor: p.n }))} /> : <EsqueletoLinhas linhas={4} />}
        </Painel>
        <Painel titulo={u.planosTitulo} apoio={u.planosApoio} carregando={dist.carregando}>
          {dist.dados ? <Ranking percentual cor="acento" itens={dist.dados.planos.map((p) => ({ rotulo: u.planoNome[p.chave] ?? p.chave, valor: p.n }))} /> : <EsqueletoLinhas linhas={4} />}
        </Painel>
        <Painel titulo={u.origensTitulo} apoio={u.origensApoio} carregando={dist.carregando}>
          {dist.dados ? <Ranking percentual cor="sono" itens={dist.dados.origens_registro.map((p) => ({ rotulo: u.origemNome[p.chave] ?? p.chave, valor: p.n }))} /> : <EsqueletoLinhas linhas={3} />}
        </Painel>
      </div>

      <div className="mt-4">
        <Painel titulo={u.listaTitulo} apoio={u.listaApoio} carregando={familias.carregando}>
          {familias.erro ? (
            <Erro mensagem={familias.erro} onTentar={familias.recarregar} />
          ) : familias.dados ? (
            <>
              <Tabela
                linhas={familias.dados}
                chave={(f) => f.id}
                colunas={[
                  { chave: "id", titulo: u.colunas.id, render: (f) => <span className="font-mono text-[12px] text-texto-mudo">{f.id.slice(0, 8)}</span> },
                  { chave: "modo", titulo: u.colunas.modo, render: (f) => u.modoNome[f.modo] ?? f.modo },
                  { chave: "momento", titulo: u.colunas.momento, render: (f) => u.momento(f.semana, f.mes_bebe) },
                  { chave: "membros", titulo: u.colunas.membros, alinhar: "dir", render: (f) => f.membros },
                  { chave: "plano", titulo: u.colunas.plano, render: (f) => u.planoNome[f.plano] ?? f.plano },
                  { chave: "registros", titulo: u.colunas.registros, alinhar: "dir", render: (f) => formatarNumero(f.registros) },
                  { chave: "criada", titulo: u.colunas.criada, render: (f) => <span className="text-texto-mudo">{formatarDataHora(f.criado_em)}</span> },
                  { chave: "ultimo", titulo: u.colunas.ultimo, render: (f) => <span className="text-texto-mudo">{formatarRelativo(f.ultimo_acesso_em)}</span> },
                ]}
              />
              {familias.dados.length >= paginas * POR_PAGINA && (
                <div className="mt-3 flex justify-center">
                  <Botao variant="secundario" onClick={() => setPaginas((p) => p + 1)} carregando={familias.carregando}>
                    {u.maisFamilias}
                  </Botao>
                </div>
              )}
            </>
          ) : (
            <EsqueletoLinhas linhas={8} />
          )}
        </Painel>
      </div>
    </div>
  );
}

/** Preenche as chaves ausentes com zero, para o histograma ter todas as colunas. */
function completar(lista: Contagem[], de: number, ate: number): Contagem[] {
  const por = new Map(lista.map((c) => [String(c.chave), c.n]));
  return Array.from({ length: ate - de + 1 }, (_, i) => ({ chave: String(de + i), n: por.get(String(de + i)) ?? 0 }));
}

function TabelaContagem({ itens, prefixo }: { itens: Contagem[]; prefixo: string }) {
  return (
    <Tabela
      linhas={itens.filter((i) => i.n > 0)}
      chave={(i) => i.chave}
      colunas={[
        { chave: "chave", titulo: prefixo, render: (i) => `${prefixo} ${i.chave}` },
        { chave: "n", titulo: "Famílias", alinhar: "dir", render: (i) => formatarNumero(i.n) },
      ]}
    />
  );
}
