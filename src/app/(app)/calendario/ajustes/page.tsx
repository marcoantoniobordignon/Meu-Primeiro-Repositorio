"use client";

import { Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { calendarioCopy as copy } from "@/copy/calendario";
import { track } from "@/lib/analytics";
import { linkDoFeed } from "@/lib/calendario/acoes";
import { temServidor } from "@/lib/familia/servidor";
import { useFamilia } from "@/lib/familia/useFamilia";

/** Tela 5 "Ajustes do calendário": gerar, copiar e revogar o link do feed (RN-08). */
export default function PaginaAjustes() {
  const { papel } = useFamilia();
  const { mostrar } = useToast();
  const [link, setLink] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [revogando, setRevogando] = useState(false);
  const [servidor, setServidor] = useState(false);

  useEffect(() => setServidor(temServidor()), []);
  if (papel !== "mae") return <Cabecalho titulo={copy.ajustes} voltarPara="/calendario" />;

  async function gerar(novo: boolean) {
    setCarregando(true);
    try {
      const l = await linkDoFeed(novo);
      setLink(l);
      if (novo) {
        track("cal_feed_revoked", {});
        mostrar(copy.revogado);
      } else track("cal_feed_created", {});
    } catch {
      mostrar(copy.erro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.ajustes} voltarPara="/calendario" />
      <div className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <h2 className="tipo-titulo-secao text-texto-mudo">{copy.feedTitulo}</h2>
        <p className="tipo-corpo text-texto-mudo">{copy.feedApoio}</p>
        {!servidor ? (
          <p className="tipo-corpo text-texto">{copy.precisaServidor}</p>
        ) : link ? (
          <>
            <Card tom="acento">
              <p className="tipo-corpo text-texto" role="note">
                {copy.feedAviso}
              </p>
            </Card>
            <Card tom="suave">
              <p className="tipo-corpo select-all break-all text-primaria-texto">{link}</p>
            </Card>
            <Botao
              largura="total"
              icone={<Copy size={16} aria-hidden />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  mostrar(copy.copiado);
                } catch {
                  /* o link fica selecionável */
                }
              }}
            >
              {copy.copiarLink}
            </Botao>
            <p className="tipo-meta">{copy.comoAssinar}</p>
            <Botao variant="fantasma" carregando={carregando} onClick={() => setRevogando(true)}>
              {copy.revogar}
            </Botao>
          </>
        ) : (
          <>
            <Card tom="acento">
              <p className="tipo-corpo text-texto" role="note">
                {copy.feedAviso}
              </p>
            </Card>
            <Botao largura="total" tamanho="lg" icone={<Link2 size={18} aria-hidden />} carregando={carregando} onClick={() => void gerar(false)}>
              {copy.gerarLink}
            </Botao>
          </>
        )}
      </div>
      <SheetConfirmar aberto={revogando} titulo={copy.revogarTitulo} texto={copy.revogarTexto} confirmar={copy.revogar} cancelar={copy.cancelar} onFechar={() => setRevogando(false)} onConfirmar={() => void gerar(true)} />
    </div>
  );
}
