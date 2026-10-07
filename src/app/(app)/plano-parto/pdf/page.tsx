"use client";

import { Download, Share2 } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { planoCopy as copy } from "@/copy/planoParto";
import { track } from "@/lib/analytics";
import { formatarLonga } from "@/lib/dates";
import { compartilharOuBaixar, montarPdfDoPlano } from "@/lib/plano/pdf";
import { usePlano } from "@/lib/plano/usePlano";
import { temPlano } from "@/lib/perfil";
import { cabecalhoDoPdf, secoesDoPdf } from "@dominio/plano-parto.ts";

/** Tela 7 "Prévia do PDF e compartilhar": a mesma estrutura do PDF; gerado no aparelho, também offline (RN-05). */
export default function PaginaPdf() {
  const { perfil, plano, ver, tz, hoje } = usePlano();
  const [gerando, setGerando] = useState(false);
  const { mostrar } = useToast();
  if (!perfil) return null;
  if (!ver || !plano) return <Cabecalho titulo={copy.pdfPrevia} voltarPara="/plano-parto" />;
  const cabecalho = cabecalhoDoPdf({ nome: perfil.papel === "mae" ? perfil.nome : null, dpp: perfil.dpp ?? null, agora: new Date(), tz, formatar: formatarLonga });
  const secoes = secoesDoPdf(plano);

  async function gerar() {
    if (!plano || !perfil) return;
    setGerando(true);
    try {
      const blob = await montarPdfDoPlano({ plano, titulo: copy.pdfTitulo, cabecalho, rodape: temPlano(perfil) ? null : copy.rodape, geradoEm: copy.pdfData(formatarLonga(hoje)) });
      track("bp_pdf_generated", { offline: typeof navigator !== "undefined" && !navigator.onLine });
      const r = await compartilharOuBaixar(blob, "plano-de-parto.pdf");
      if (r === "compartilhado") track("bp_pdf_shared", {});
      mostrar(copy.pronto);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) mostrar(copy.erro);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.pdfPrevia} voltarPara="/plano-parto" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.pdfApoio}</p>
        <Card>
          <div className="flex flex-col gap-3" data-testid="previa-pdf">
            <p className="text-[20px] font-semibold text-texto">{copy.pdfTitulo}</p>
            {cabecalho.map((l) => (
              <p key={l} className="tipo-meta">
                {l}
              </p>
            ))}
            {secoes.map((s) => (
              <section key={s.titulo}>
                <h2 className="text-[15px] font-semibold text-texto">{s.titulo}</h2>
                {s.linhas.map((l) => (
                  <p key={l} className="tipo-corpo text-texto">
                    {l.startsWith("[x] ") ? `✓ ${l.slice(4)}` : l}
                  </p>
                ))}
              </section>
            ))}
            {!secoes.length && <p className="tipo-corpo text-texto-mudo">{copy.pdfVazio}</p>}
            {!temPlano(perfil) && <p className="tipo-meta self-end">{copy.rodape}</p>}
          </div>
        </Card>
        <Botao largura="total" tamanho="lg" carregando={gerando} icone={typeof navigator !== "undefined" && "share" in navigator ? <Share2 size={18} aria-hidden /> : <Download size={18} aria-hidden />} onClick={() => void gerar()}>
          {gerando ? copy.gerando : typeof navigator !== "undefined" && "share" in navigator ? copy.compartilhar : copy.baixar}
        </Botao>
      </div>
    </div>
  );
}
