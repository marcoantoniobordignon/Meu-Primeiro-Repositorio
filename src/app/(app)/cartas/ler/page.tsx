"use client";

import { Download, Link2, Lock, Trash2, Unlock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { Audio } from "@/components/ui/Audio";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Foto } from "@/components/ui/Foto";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { cartasCopy as copy } from "@/copy/cartas";
import { track } from "@/lib/analytics";
import { criarLink, deslacrar, ErroCarta, excluir, exportar, revogarLink } from "@/lib/cartas/acoes";
import { useCartas } from "@/lib/cartas/useCartas";
import { compartilharArquivo, compartilharTexto } from "@/lib/compartilhar";
import { formatarComAno } from "@/lib/dates";
import { nomeDeArquivo } from "@dominio/cartas.ts";

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const { mostrar } = useToast();
  const { perfil, cartas, nomeDoBebe } = useCartas();
  const id = params.get("id");
  const c = cartas.find((x) => x.id === id);
  const [confirmacao, setConfirmacao] = useState<0 | 1 | 2>(0);
  const [apagando, setApagando] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (c?.status === "draft") router.replace(`/cartas/escrever?id=${c.id}`);
  }, [c?.status, c?.id, router]);

  if (!perfil) return null;
  if (!c || c.apagado_em)
    return (
      <div>
        <Cabecalho titulo={copy.titulo} voltarPara="/cartas" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.excluir.pronto}</p>
      </div>
    );
  const nome = nomeDoBebe ?? copy.bebe;
  const falhou = (e: unknown) => setErro(copy.lacre.erros[(e instanceof ErroCarta ? e.message : "desconhecido") as keyof typeof copy.lacre.erros] ?? copy.lacre.erros.desconhecido);

  async function gerarLink() {
    setErro(null);
    try {
      const url = await criarLink(c!.id);
      setLink(url);
      track("letter_share_link_created", {});
      const r = await compartilharTexto(`${copy.aberta.textoCompartilhar(c!.title)} ${url}`);
      mostrar(r === "copiado" ? copy.aberta.copiado : copy.aberta.linkPronto);
    } catch (e) {
      falhou(e);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/cartas" />
      <article className="flex flex-col gap-4 px-5 pb-8 pt-1">
        <header className="flex flex-col gap-1">
          <p className="tipo-meta">{copy.para(nome)}</p>
          <h2 className="font-serifa text-[28px] leading-tight text-texto">{c.title}</h2>
          {c.status === "sealed" && c.open_on && <p className="tipo-meta">{copy.abreEm(formatarComAno(c.open_on))}</p>}
          {c.status === "opened" && c.opened_at && <p className="tipo-meta">{copy.abriuEm(formatarComAno(c.opened_at.slice(0, 10)))}</p>}
        </header>

        {c.status === "sealed" ? (
          // RN-03: lacrada, só título e data (o aparelho nem tem mais o conteúdo).
          <Card tom="suave">
            <p className="tipo-corpo flex items-center gap-2 text-texto">
              <Lock size={16} aria-hidden />
              {copy.lacrada.apoio}
            </p>
            <div className="mt-3">
              <Botao variant="secundario" icone={<Unlock size={16} aria-hidden />} onClick={() => setConfirmacao(1)}>
                {copy.lacrada.deslacrar}
              </Botao>
            </div>
          </Card>
        ) : (
          <>
            {c.body && <div className="font-serifa whitespace-pre-line text-[18px] leading-relaxed text-texto">{c.body}</div>}
            {c.audio_path && <Audio rotulo={copy.publica.audio} caminho={c.audio_path} />}
            {c.photo_path && <Foto caminho={c.photo_path} alt={copy.publica.foto} ajuste="contain" />}
            <Card>
              <h3 className="text-[16px] font-medium text-texto">{copy.aberta.entregar(nome)}</h3>
              <p className="tipo-meta mt-0.5">{copy.aberta.entregarApoio}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Botao icone={<Link2 size={16} aria-hidden />} onClick={() => void gerarLink()}>
                  {copy.aberta.gerarLink}
                </Botao>
                {link && (
                  <Botao
                    variant="fantasma"
                    onClick={() =>
                      void revogarLink(c.id)
                        .then(() => {
                          setLink(null);
                          mostrar(copy.aberta.revogado);
                        })
                        .catch(falhou)
                    }
                  >
                    {copy.aberta.revogar}
                  </Botao>
                )}
              </div>
              {link && <p className="tipo-meta mt-2 break-all" data-link-carta>{link}</p>}
            </Card>
            <Botao
              variant="secundario"
              icone={<Download size={16} aria-hidden />}
              onClick={() =>
                void exportar([c]).then(async ({ blob }) => {
                  const r = await compartilharArquivo(new File([blob], nomeDeArquivo(c.title, "zip"), { type: "application/zip" }));
                  if (r !== "cancelado" && r !== "falhou") track("letter_exported", {});
                })
              }
            >
              {copy.aberta.exportar}
            </Botao>
          </>
        )}

        {erro && (
          <p className="tipo-corpo text-erro" role="alert">
            {erro}
          </p>
        )}
        {/* RN-08: a lacrada pode ser excluída sem ser lida. */}
        <Botao variant="fantasma" icone={<Trash2 size={16} aria-hidden />} onClick={() => setApagando(true)}>
          {copy.editor.excluir}
        </Botao>
      </article>

      {/* RN-04: duas confirmações para abrir antes da hora. */}
      <SheetConfirmar aberto={confirmacao === 1} titulo={copy.lacrada.confirmar1} texto={copy.lacrada.confirmar1Texto} confirmar={copy.lacrada.sim} cancelar={copy.lacrada.nao} onFechar={() => setConfirmacao((x) => (x === 1 ? 0 : x))} onConfirmar={() => setTimeout(() => setConfirmacao(2), 0)} />
      <SheetConfirmar
        aberto={confirmacao === 2}
        titulo={copy.lacrada.confirmar2}
        texto={copy.lacrada.confirmar2Texto}
        confirmar={copy.lacrada.simMesmo}
        cancelar={copy.lacrada.nao}
        onFechar={() => setConfirmacao((x) => (x === 2 ? 0 : x))}
        onConfirmar={() =>
          void deslacrar(c.id)
            .then(() => {
              track("letter_unsealed", {});
              mostrar(copy.lacrada.deslacrada);
              router.replace(`/cartas/escrever?id=${c.id}`);
            })
            .catch(falhou)
        }
      />
      <SheetConfirmar
        aberto={apagando}
        titulo={copy.excluir.titulo}
        texto={copy.excluir.texto}
        confirmar={copy.excluir.confirmar}
        cancelar={copy.excluir.cancelar}
        onFechar={() => setApagando(false)}
        onConfirmar={() =>
          void excluir(c.id).then(() => {
            mostrar(copy.excluir.pronto);
            router.replace("/cartas");
          })
        }
      />
    </div>
  );
}

/** Tela 4 "Carta aberta" (leitura, entregar por link, exportar) e a lacrada (título, data, abrir antes da hora). */
export default function PaginaLerCarta() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
