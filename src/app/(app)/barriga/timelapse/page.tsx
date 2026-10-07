"use client";

import { Download, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Faixa } from "@/components/ui/Faixa";
import { Foto } from "@/components/ui/Foto";
import { useToast } from "@/components/ui/Toast";
import { barrigaCopy as copy } from "@/copy/barriga";
import { track } from "@/lib/analytics";
import { lerArquivo } from "@/lib/arquivos/arquivos";
import { quadrosDoTimelapse, timelapseDisponivel, VELOCIDADE_PADRAO, VELOCIDADES, type Plano, type Velocidade } from "@/lib/barriga/regras";
import { exportarTimelapse, suportaExportarVideo } from "@/lib/barriga/video";
import { compartilharArquivo } from "@/lib/compartilhar";
import { useColecao } from "@/lib/dados/colecao";
import { bellyPhotos } from "@/lib/dados/colecoes";
import { temPlano, usePerfil } from "@/lib/perfil";

/** Tela 5 "Timelapse": player, velocidade (RN-07) e "Exportar vídeo" (RN-08). */
export default function PaginaTimelapse() {
  const fotos = useColecao(bellyPhotos);
  const perfil = usePerfil();
  const quadros = useMemo(() => quadrosDoTimelapse(fotos), [fotos]);
  const [i, setI] = useState(0);
  const [tocando, setTocando] = useState(false);
  const [velocidade, setVelocidade] = useState<Velocidade>(VELOCIDADE_PADRAO);
  const [exportando, setExportando] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const [formato, setFormato] = useState<string | null | undefined>(undefined);
  const reportado = useRef(false);
  const { mostrar } = useToast();
  const plano: Plano = temPlano(perfil) ? "premium" : "free";

  useEffect(() => setFormato(suportaExportarVideo()), []);

  useEffect(() => {
    if (!tocando || quadros.length === 0) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % quadros.length), velocidade * 1000);
    return () => window.clearInterval(t);
  }, [tocando, velocidade, quadros.length]);

  if (!timelapseDisponivel(fotos)) {
    return (
      <div>
        <Cabecalho titulo={copy.timelapse} voltarPara="/barriga" />
        <p className="tipo-corpo px-5 text-texto-mudo">{copy.minimo}</p>
      </div>
    );
  }
  const atual = quadros[Math.min(i, quadros.length - 1)]!;

  function tocar() {
    if (!tocando && !reportado.current) {
      track("belly_timelapse_played", { photos: quadros.length });
      reportado.current = true;
    }
    setTocando((t) => !t);
  }

  async function exportar(tier: Plano) {
    setExportando(true);
    setTocando(false);
    track("belly_video_export_started", { tier });
    try {
      const blobs = await Promise.all(quadros.map(async (q) => ({ blob: await lerArquivo(q.storage_path), semana: q.gest_week })));
      const disponiveis = blobs.filter((b): b is { blob: Blob; semana: number } => Boolean(b.blob));
      const { blob, extensao } = await exportarTimelapse(disponiveis, { plano: tier, segundosPorFoto: velocidade, rotuloSemana: copy.seloSemana, marcaTexto: copy.marca });
      track("belly_video_exported", { tier, ok: true });
      await compartilharArquivo(new File([blob], `ninho-barriga.${extensao}`, { type: blob.type }));
      mostrar(copy.exportado);
    } catch {
      track("belly_video_exported", { tier, ok: false });
      mostrar(copy.exportarErro);
    } finally {
      setExportando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={copy.timelapse} voltarPara="/barriga" />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <div className="relative aspect-[3/4] overflow-hidden rounded-card bg-fio">
          <Foto caminho={atual.storage_path} alt={copy.semana(atual.gest_week)} />
          <span className="absolute left-3 top-3 rounded-pilula bg-texto/55 px-3 py-1 text-[13px] font-medium text-superficie">{copy.semana(atual.gest_week)}</span>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" aria-label={tocando ? copy.pausar : copy.play} onClick={tocar} className="grid size-12 shrink-0 place-items-center rounded-full bg-primaria text-white">
            {tocando ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <Escolha semRotulo rotulo={copy.velocidade} opcoes={VELOCIDADES.map((v) => ({ valor: v, rotulo: copy.velocidades[String(v)] ?? `${v}s` }))} valor={velocidade} onMudar={setVelocidade} />
        </div>

        {formato === null ? (
          <Faixa tom="alerta">{copy.semExportar}</Faixa>
        ) : (
          <Card compacto>
            <div className="flex flex-col gap-2 py-1">
              <Botao largura="total" tamanho="lg" icone={<Download size={18} aria-hidden />} carregando={exportando} disabled={formato === undefined} onClick={() => void exportar(plano)}>
                {exportando ? copy.exportando : plano === "premium" ? copy.exportar : copy.exportarFree}
              </Botao>
              {plano === "free" && (
                <Botao largura="total" variant="fantasma" disabled={exportando} onClick={() => setPaywall(true)}>
                  {copy.exportarHd}
                </Botao>
              )}
            </div>
          </Card>
        )}
      </div>
      <SheetPaywall
        aberto={paywall}
        gatilho={{ feature: "belly_video", trigger: "hd_export" }}
        onFechar={() => setPaywall(false)}
        alternativa={{ rotulo: copy.exportarMarca, onClick: () => void exportar("free") }}
      />
    </div>
  );
}
