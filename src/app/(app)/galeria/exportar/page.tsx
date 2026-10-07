"use client";

import { Check, FileDown } from "lucide-react";
import { useEffect, useState } from "react";

import { tituloDoDocumento } from "@/components/features/galeria/ItemDocumento";
import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { galeriaCopy as copy } from "@/copy/galeria";
import { track } from "@/lib/analytics";
import { formatarLonga } from "@/lib/dates";
import { cabeNaExportacao, montarPdf, paginasSelecionadas, publicarExportacao } from "@/lib/galeria/exportar";
import { ordenar, paginasDo, semanaDoDocumento } from "@/lib/galeria/regras";
import { useGaleria } from "@/lib/galeria/useGaleria";
import { temPlano } from "@/lib/perfil";

type Pronto = { url: string; publicado: boolean };

/** Tela 4 "Selecionar e exportar" (premium, RN-09): até 50 páginas, capa, uma seção por documento, link de 24 h. */
export default function PaginaExportar() {
  const { docs, paginas, perfil, hoje, podeEditar } = useGaleria();
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [gerando, setGerando] = useState(false);
  const [pronto, setPronto] = useState<Pronto | null>(null);
  const [erro, setErro] = useState(false);
  const [paywall, setPaywall] = useState(false);

  // O arquivo local só vive enquanto a tela está aberta.
  useEffect(() => () => void (pronto && !pronto.publicado && URL.revokeObjectURL(pronto.url)), [pronto]);

  if (!perfil) return null;
  if (!podeEditar) return <Cabecalho titulo={copy.exportarTitulo} voltarPara="/galeria" />;
  const dpp = perfil.dpp;
  const lista = ordenar(docs).filter((d) => paginasDo(d.id, paginas).length > 0);
  const escolhidos = lista.filter((d) => marcados.has(d.id));
  const total = paginasSelecionadas(escolhidos, paginas);
  const cabe = cabeNaExportacao(escolhidos, paginas);

  function alternar(id: string) {
    setPronto(null);
    setMarcados((m) => {
      const n = new Set(m);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function gerar() {
    if (!perfil) return;
    if (!temPlano(perfil)) return setPaywall(true);
    if (!escolhidos.length || !cabe) return;
    setGerando(true);
    setErro(false);
    try {
      const semanaHoje = semanaDoDocumento(dpp, hoje);
      const capa = {
        titulo: copy.capaTitulo,
        linhas: [perfil.nome ? copy.capaNome(perfil.nome) : null, dpp ? copy.capaDpp(formatarLonga(dpp)) : null, semanaHoje !== null ? copy.capaSemana(semanaHoje) : null, copy.capaGerado(formatarLonga(hoje))].filter((l): l is string => Boolean(l)),
      };
      // Mesma ordem da galeria; cada seção abre com o que ela registrou, sem interpretação.
      const secoes = escolhidos.map((documento) => {
        const s = semanaDoDocumento(dpp, documento.exam_date);
        return {
          documento,
          cabecalho: [tituloDoDocumento(documento), [copy.tipos[documento.kind], formatarLonga(documento.exam_date), s !== null ? copy.semana(s) : null].filter(Boolean).join(" · "), ...(documento.notes ? [documento.notes] : [])],
        };
      });
      const pdf = await montarPdf(capa, secoes, paginas);
      const link = await publicarExportacao(pdf);
      setPronto(link ? { url: link, publicado: true } : { url: URL.createObjectURL(pdf), publicado: false });
      track("exam_doc_exported", { docs: escolhidos.length, pages: total });
    } catch {
      setErro(true);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.exportarTitulo} voltarPara="/galeria" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.exportarApoio}</p>
        <ul className="flex flex-col gap-2">
          {lista.map((d) => {
            const ligado = marcados.has(d.id);
            const n = paginasDo(d.id, paginas).length;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={ligado}
                  aria-label={copy.selecionar(tituloDoDocumento(d))}
                  onClick={() => alternar(d.id)}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-[16px] border px-4 py-3 text-left ${ligado ? "border-primaria bg-primaria-suave" : "border-fio bg-superficie"}`}
                >
                  <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-[6px] border ${ligado ? "border-primaria bg-primaria text-superficie" : "border-fio"}`}>
                    {ligado && <Check size={16} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-texto">{tituloDoDocumento(d)}</span>
                    <span className="tipo-meta block">
                      {formatarLonga(d.exam_date)} · {copy.paginas(n)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className={`tipo-meta ${cabe ? "" : "text-erro"}`} aria-live="polite">
          {cabe ? copy.selecionadas(total) : copy.passouExportacao}
        </p>
        <Botao largura="total" tamanho="lg" icone={<FileDown size={18} aria-hidden />} carregando={gerando} disabled={!escolhidos.length || !cabe} onClick={() => void gerar()}>
          {gerando ? copy.gerando : copy.gerar}
        </Botao>
        {erro && <p className="text-[13px] text-erro">{copy.erroExportar}</p>}
        {pronto && (
          <Card>
            <p className="tipo-corpo text-texto" role="status">
              {copy.gerado}
            </p>
            <a href={pronto.url} download="ninho-exames.pdf" target={pronto.publicado ? "_blank" : undefined} rel="noreferrer" className="mt-2 inline-flex min-h-11 items-center text-[15px] font-medium text-primaria-texto">
              {copy.link}
            </a>
            {pronto.publicado && <p className="tipo-meta">{copy.linkApoio}</p>}
          </Card>
        )}
      </div>
      <SheetPaywall aberto={paywall} gatilho={{ feature: "exam_gallery", trigger: "pdf_export" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}
