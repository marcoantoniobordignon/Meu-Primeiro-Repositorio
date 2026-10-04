"use client";

import { Erro, EsqueletoLinhas } from "@/components/admin/Estado";
import { Indicador } from "@/components/admin/Indicador";
import { Painel } from "@/components/admin/Painel";
import { Tabela } from "@/components/admin/Tabela";
import { Titulo } from "@/components/admin/Titulo";
import { adminCopy as copy } from "@/copy/admin";
import { useDados } from "@/lib/admin/fonte";
import { formatarMs, formatarPercentual, formatarRelativo } from "@/lib/admin/formato";
import type { VozItem } from "@/lib/admin/tipos";

const vz = copy.voz;

export default function PaginaVoz() {
  const voz = useDados((f) => f.voz(50));
  const d = voz.dados;

  return (
    <div>
      <Titulo titulo={vz.titulo} apoio={vz.apoio} />
      {voz.erro && (
        <div className="mb-4">
          <Erro mensagem={voz.erro} onTentar={voz.recarregar} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Indicador rotulo={vz.total} valor={d?.total} apoio={d ? `${d.total_30d} em 30 dias` : undefined} carregando={voz.carregando} />
        <Indicador rotulo={vz.aceitas} valor={d ? formatarPercentual(d.aceitas, d.total) : undefined} apoio={d ? `${d.aceitas} de ${d.total}` : undefined} carregando={voz.carregando} />
        <Indicador rotulo={vz.corrigidas} valor={d ? formatarPercentual(d.corrigidas, d.total) : undefined} apoio={d ? `${d.corrigidas}` : undefined} carregando={voz.carregando} />
        <Indicador rotulo={vz.confianca} valor={d?.confianca_media !== null && d?.confianca_media !== undefined ? d.confianca_media.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : undefined} carregando={voz.carregando} />
        <Indicador rotulo={vz.latencia} valor={d ? formatarMs(d.ms_mediano) : undefined} carregando={voz.carregando} />
      </div>

      <div className="mt-4">
        <Painel titulo={vz.recentesTitulo} apoio={vz.recentesApoio} carregando={voz.carregando}>
          {d ? (
            <Tabela
              linhas={d.recentes}
              chave={(i) => i.id}
              vazio={vz.vazio}
              colunas={[
                { chave: "quando", titulo: vz.colunas.quando, render: (i) => <span className="whitespace-nowrap text-texto-mudo">{formatarRelativo(i.criado_em)}</span> },
                { chave: "transcricao", titulo: vz.colunas.transcricao, render: (i) => <span className="tipo-voz text-texto">“{i.transcricao ?? "…"}”</span> },
                { chave: "resultado", titulo: vz.colunas.resultado, render: (i) => <span className="text-texto-mudo">{resumoResposta(i.resposta)}</span> },
                { chave: "confianca", titulo: vz.colunas.confianca, alinhar: "dir", render: (i) => (i.confianca === null ? "–" : i.confianca.toLocaleString("pt-BR", { maximumFractionDigits: 2 })) },
                { chave: "estado", titulo: vz.colunas.estado, render: (i) => <Estado item={i} /> },
                { chave: "tempo", titulo: vz.colunas.tempo, alinhar: "dir", render: (i) => formatarMs(i.ms_total) },
              ]}
            />
          ) : (
            <EsqueletoLinhas linhas={8} />
          )}
        </Painel>
      </div>
    </div>
  );
}

function resumoResposta(resposta: unknown): string {
  const registros = (resposta as { registros?: { tipo?: string }[] } | null)?.registros;
  if (!Array.isArray(registros)) return vz.resumoResposta(0, "");
  const tipos = [...new Set(registros.map((r) => r.tipo ?? "?"))].join(", ");
  return vz.resumoResposta(registros.length, tipos);
}

function Estado({ item }: { item: VozItem }) {
  const [texto, classe] = item.aceita ? [vz.estado.aceita, "text-sucesso bg-sucesso"] : item.corrigida ? [vz.estado.corrigida, "text-texto bg-fralda"] : item.aceita === false ? [vz.estado.recusada, "text-erro bg-erro"] : [vz.estado.pendente, "text-texto-mudo bg-texto-mudo"];
  const [cor, ponto] = classe.split(" ");
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] ${cor}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${ponto}`} />
      {texto}
    </span>
  );
}
