"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";

import { Erro, EsqueletoGrafico, EsqueletoLinhas } from "@/components/admin/Estado";
import { GraficoColunas } from "@/components/admin/GraficoColunas";
import { GraficoLinha } from "@/components/admin/GraficoLinha";
import { Indicador } from "@/components/admin/Indicador";
import { Painel } from "@/components/admin/Painel";
import { Ranking } from "@/components/admin/Ranking";
import { Segmentado } from "@/components/admin/Segmentado";
import { Tabela } from "@/components/admin/Tabela";
import { Titulo } from "@/components/admin/Titulo";
import { adminCopy as copy } from "@/copy/admin";
import type { CorSerie } from "@/components/admin/graficos";
import { useDados } from "@/lib/admin/fonte";
import { formatarDiaCurto, formatarNumero, formatarRelativo, somar, variacao } from "@/lib/admin/formato";
import type { PontoDia } from "@/lib/admin/tipos";
import { nomeDoSintoma } from "@/lib/sintomas/catalogo";

type Periodo = "7" | "30" | "90";
const v = copy.visao;
const corTipo: Record<string, CorSerie> = { sono: "sono", mamada: "mamada", fralda: "fralda", banho: "banho", outro: "primaria" };

export default function PaginaVisaoGeral() {
  const [periodo, setPeriodo] = useState<Periodo>("30");
  const dias = Number(periodo);
  const resumo = useDados((f) => f.resumo());
  const serie = useDados((f) => f.serie(dias * 2), [dias]);
  const dist = useDados((f) => f.distribuicoes());

  const atual = serie.dados?.slice(-dias) ?? [];
  const anterior = serie.dados?.slice(0, -dias) ?? [];
  const novasAtual = somar(atual, (p) => p.novas);
  const novasAnterior = somar(anterior, (p) => p.novas);
  const r = resumo.dados;

  function recarregar() {
    resumo.recarregar();
    serie.recarregar();
    dist.recarregar();
  }

  return (
    <div>
      <Titulo
        titulo={v.titulo}
        apoio={resumo.atualizadoEm ? copy.estados.atualizado(formatarRelativo(resumo.atualizadoEm.toISOString())) : undefined}
        acao={
          <div className="flex items-center gap-2">
            <Segmentado
              rotulo={copy.periodo.rotulo}
              valor={periodo}
              onMudar={setPeriodo}
              opcoes={[
                { valor: "7", rotulo: copy.periodo.d7 },
                { valor: "30", rotulo: copy.periodo.d30 },
                { valor: "90", rotulo: copy.periodo.d90 },
              ]}
            />
            <button type="button" onClick={recarregar} aria-label={copy.estados.atualizar} title={copy.estados.atualizar} className="grid size-11 place-items-center rounded-pilula text-texto-mudo hover:bg-superficie hover:text-texto">
              <RefreshCw size={16} className={resumo.carregando ? "anim-girar" : ""} />
            </button>
          </div>
        }
      />

      {resumo.erro && (
        <div className="mb-4">
          <Erro mensagem={resumo.erro} onTentar={recarregar} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo={v.familias} valor={r?.familias} apoio={v.familiasApoio} carregando={resumo.carregando} />
        <Indicador rotulo={`Novas em ${dias} dias`} valor={novasAtual} delta={variacao(novasAtual, novasAnterior)} apoio={v.vsAnterior} carregando={serie.carregando} />
        <Indicador rotulo={v.ativas7d} valor={r?.ativas_7d} apoio={r ? `${formatarNumero(r.ativas_1d)} hoje · ${formatarNumero(r.ativas_30d)} em 30 dias` : undefined} carregando={resumo.carregando} />
        <Indicador rotulo={v.pagantes} valor={r?.plano_ativo} apoio={r ? v.pagantesApoio(r.trial, r.cortesia) : undefined} carregando={resumo.carregando} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Painel
          titulo={v.serieTitulo}
          apoio={v.serieApoio}
          carregando={serie.carregando}
          tabela={<TabelaSerie linhas={atual} campos={[["novas", v.novas], ["ativas", v.ativas]]} />}
        >
          {serie.dados ? (
            <GraficoLinha
              rotulos={atual.map((p) => p.dia)}
              formatarRotulo={formatarDiaCurto}
              descricao={v.serieTitulo}
              series={[
                { nome: v.ativas, cor: "primaria", valores: atual.map((p) => p.ativas) },
                { nome: v.novas, cor: "acento", valores: atual.map((p) => p.novas) },
              ]}
            />
          ) : (
            <EsqueletoGrafico />
          )}
        </Painel>

        <Painel
          titulo={v.usoTitulo}
          apoio={v.usoApoio}
          carregando={serie.carregando}
          tabela={<TabelaSerie linhas={atual} campos={[["registros", v.registros], ["leituras", v.leituras]]} />}
        >
          {serie.dados ? (
            <GraficoLinha
              rotulos={atual.map((p) => p.dia)}
              formatarRotulo={formatarDiaCurto}
              descricao={v.usoTitulo}
              series={[
                { nome: v.registros, cor: "sono", valores: atual.map((p) => p.registros) },
                { nome: v.leituras, cor: "banho", valores: atual.map((p) => p.leituras) },
              ]}
            />
          ) : (
            <EsqueletoGrafico />
          )}
        </Painel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Painel titulo={v.modo} apoio={v.modoApoio} carregando={resumo.carregando}>
          {r ? (
            <Ranking
              percentual
              itens={[
                { rotulo: copy.usuarias.modoNome.gestacao ?? "Gestação", valor: r.gestacao, cor: "primaria" },
                { rotulo: copy.usuarias.modoNome.bebe ?? "Bebê", valor: r.bebe, cor: "banho" },
              ]}
            />
          ) : (
            <EsqueletoLinhas linhas={2} />
          )}
          <div className="mt-5 border-t border-fio pt-4">
            <p className="tipo-titulo-secao text-texto-mudo">{v.funilTitulo}</p>
            <p className="tipo-meta mb-3">{v.funilApoio}</p>
            {r ? (
              <Ranking
                percentual
                cor="primaria"
                itens={[
                  { rotulo: v.perfis, valor: r.perfis },
                  { rotulo: v.onboarding, valor: r.onboarding_concluido },
                  { rotulo: v.comEmail, valor: r.com_email },
                ]}
              />
            ) : (
              <EsqueletoLinhas linhas={3} />
            )}
          </div>
        </Painel>

        <Painel
          titulo={v.tiposTitulo}
          apoio={v.tiposApoio}
          carregando={dist.carregando}
          tabela={<TabelaContagem itens={(dist.dados?.tipos_registro ?? []).map((t) => ({ rotulo: copy.usuarias.tipoNome[t.chave] ?? t.chave, valor: t.n }))} />}
        >
          {dist.dados ? (
            <GraficoColunas
              descricao={v.tiposTitulo}
              itens={dist.dados.tipos_registro.map((t) => ({ rotulo: copy.usuarias.tipoNome[t.chave] ?? t.chave, valor: t.n, cor: corTipo[t.chave] ?? "primaria" }))}
            />
          ) : (
            <EsqueletoGrafico altura={160} />
          )}
        </Painel>

        <Painel titulo={v.sintomasTitulo} apoio={v.sintomasApoio} carregando={dist.carregando}>
          {dist.dados ? <Ranking cor="acento" itens={dist.dados.sintomas.map((s) => ({ rotulo: nomeDoSintoma(s.chave), valor: s.n }))} vazio={copy.estados.vazio} /> : <EsqueletoLinhas linhas={6} />}
        </Painel>
      </div>
    </div>
  );
}

function TabelaSerie({ linhas, campos }: { linhas: PontoDia[]; campos: [keyof PontoDia, string][] }) {
  return (
    <Tabela
      linhas={[...linhas].reverse()}
      chave={(l) => l.dia}
      colunas={[
        { chave: "dia", titulo: "Dia", render: (l) => formatarDiaCurto(l.dia) },
        ...campos.map(([campo, titulo]) => ({ chave: String(campo), titulo, alinhar: "dir" as const, render: (l: PontoDia) => formatarNumero(Number(l[campo])) })),
      ]}
    />
  );
}

function TabelaContagem({ itens }: { itens: { rotulo: string; valor: number }[] }) {
  return (
    <Tabela
      linhas={itens}
      chave={(i) => i.rotulo}
      colunas={[
        { chave: "rotulo", titulo: "Item", render: (i) => i.rotulo },
        { chave: "valor", titulo: "Total", alinhar: "dir", render: (i) => formatarNumero(i.valor) },
      ]}
    />
  );
}
