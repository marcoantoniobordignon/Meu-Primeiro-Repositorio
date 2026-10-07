"use client";

import { Camera, Share2, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Foto } from "@/components/ui/Foto";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { barrigaCopy as copy } from "@/copy/barriga";
import { track } from "@/lib/analytics";
import { lerArquivo } from "@/lib/arquivos/arquivos";
import { editarLegenda, excluirFoto } from "@/lib/barriga/acoes";
import { nomeDoArquivo } from "@/lib/barriga/regras";
import { imagemParaCompartilhar } from "@/lib/barriga/video";
import { compartilharArquivo } from "@/lib/compartilhar";
import { useColecao } from "@/lib/dados/colecao";
import { bellyPhotos } from "@/lib/dados/colecoes";
import { formatarLonga } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";

/** Tela 4 "Foto da semana": tela cheia, legenda, substituir, excluir (RN-10) e compartilhar (RN-09). */
export default function PaginaFotoDaSemana() {
  const { semana: bruto } = useParams<{ semana: string }>();
  const semana = Number(bruto);
  const fotos = useColecao(bellyPhotos);
  const { permissoes } = useFamilia();
  const router = useRouter();
  const { mostrar } = useToast();
  const f = fotos.find((x) => x.gest_week === semana);
  const [legenda, setLegenda] = useState(f?.caption ?? "");
  const [excluindo, setExcluindo] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);

  useEffect(() => setLegenda(f?.caption ?? ""), [f?.caption]);

  if (!f) return <Cabecalho titulo={copy.semana(semana)} voltarPara="/barriga" />;
  const foto = f;
  const pode = permissoes.tirarFotosBarriga;

  async function compartilhar() {
    setCompartilhando(true);
    try {
      const blob = await lerArquivo(foto.storage_path);
      if (!blob) throw new Error("sem arquivo");
      const png = await imagemParaCompartilhar(blob, foto.gest_week, copy.seloSemana);
      const r = await compartilharArquivo(new File([png], nomeDoArquivo(foto.gest_week, "png"), { type: "image/png" }));
      if (r === "compartilhado" || r === "copiado") track("belly_photo_shared", {});
      if (r === "copiado") mostrar(copy.salvaNoAparelho);
    } catch {
      mostrar(copy.semArquivo);
    } finally {
      setCompartilhando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.semana(semana)} voltarPara="/barriga" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <div className="aspect-[3/4] overflow-hidden rounded-card bg-fio">
          <Foto caminho={foto.storage_path} alt={copy.semana(semana)} ajuste="contain" semArquivo={copy.semArquivo} />
        </div>
        <p className="tipo-meta">{formatarLonga(foto.taken_on)}</p>
        {pode ? (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <CampoTexto rotulo={copy.legenda} value={legenda} maxLength={100} onChange={(e) => setLegenda(e.target.value)} autoComplete="off" />
            </div>
            {legenda !== (foto.caption ?? "") && (
              <Botao
                variant="secundario"
                onClick={() => {
                  editarLegenda(foto, legenda);
                  mostrar(copy.legendaSalva);
                }}
              >
                {copy.salvarLegenda}
              </Botao>
            )}
          </div>
        ) : (
          foto.caption && <p className="tipo-corpo text-texto">{foto.caption}</p>
        )}
        <div className="flex flex-col gap-2">
          <Botao largura="total" icone={<Share2 size={18} aria-hidden />} carregando={compartilhando} onClick={() => void compartilhar()}>
            {copy.compartilhar}
          </Botao>
          {pode && (
            <div className="flex gap-2">
              <Botao largura="total" variant="secundario" icone={<Camera size={16} aria-hidden />} onClick={() => router.push(`/barriga/camera?semana=${semana}`)}>
                {copy.substituirFoto}
              </Botao>
              <Botao largura="total" variant="fantasma" icone={<Trash2 size={16} aria-hidden />} onClick={() => setExcluindo(true)}>
                {copy.excluir}
              </Botao>
            </div>
          )}
        </div>
      </div>
      <SheetConfirmar
        aberto={excluindo}
        titulo={copy.excluirTitulo}
        texto={copy.excluirTexto}
        confirmar={copy.excluir}
        cancelar={copy.cancelar}
        onFechar={() => setExcluindo(false)}
        onConfirmar={() => {
          void excluirFoto(foto);
          track("belly_photo_deleted", {});
          mostrar(copy.excluida);
          router.replace("/barriga");
        }}
      />
    </div>
  );
}
