"use client";

import { ImagePlus, Mic, Square, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { BotaoDitado } from "@/components/features/voz/BotaoDitado";
import { Audio } from "@/components/ui/Audio";
import { Botao } from "@/components/ui/Botao";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Foto } from "@/components/ui/Foto";
import { useToast } from "@/components/ui/Toast";
import { diarioCopy as copy } from "@/copy/diario";
import { track } from "@/lib/analytics";
import { novoId } from "@/lib/dados/colecao";
import type { DiaryEntry, DiaryPhoto } from "@/lib/dados/colecoes";
import { adiarMarco, pularMarco, salvarEntrada, type FotoDoEditor } from "@/lib/diario/acoes";
import { audioPassaDoLimite, dataValida, entradaValida, MAX_FOTOS, MAX_TEXTO } from "@/lib/diario/regras";
import { useDiario } from "@/lib/diario/useDiario";
import { gravarAudio, suportaGravarAudio, type Gravacao } from "@/lib/midia/audio";
import { processarFoto } from "@/lib/midia/imagem";
import { temPlano } from "@/lib/perfil";
import { perguntaDoMarco, type Marco } from "@dominio/diario.ts";

interface Props {
  marco?: Marco;
  existente?: DiaryEntry;
  fotosExistentes: DiaryPhoto[];
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type EstadoAudio = { tipo: "nenhum" } | { tipo: "existente"; caminho: string; segundos: number | null } | { tipo: "novo"; blob: Blob; segundos: number };

function MiniaturaNova({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt={alt} className="size-full object-cover" /> : null;
}

/** Telas 2 e 3: marco (com a pergunta) ou entrada livre. Texto com ditado, áudio de até 3 min, até 3 fotos e data. */
export function EditorEntrada({ marco, existente, fotosExistentes }: Props) {
  const { perfil, eu, entradas, hoje, modoFe } = useDiario();
  const router = useRouter();
  const { mostrar } = useToast();
  const [texto, setTexto] = useState(existente?.body ?? "");
  const [parcial, setParcial] = useState("");
  const [data, setData] = useState(existente?.entry_date ?? hoje);
  const [audio, setAudio] = useState<EstadoAudio>(existente?.audio_path ? { tipo: "existente", caminho: existente.audio_path, segundos: existente.audio_seconds } : { tipo: "nenhum" });
  const [fotos, setFotos] = useState<FotoDoEditor[]>(() => [...fotosExistentes].sort((a, b) => a.position - b.position).map((foto) => ({ tipo: "existente", foto })));
  const [gravando, setGravando] = useState<number | null>(null);
  const [usouDitado, setUsouDitado] = useState(false);
  const [tocou, setTocou] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [paywall, setPaywall] = useState(false);
  const gravacao = useRef<Gravacao | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);

  useEffect(() => () => gravacao.current?.cancelar(), []);

  const temConteudo = entradaValida({ body: texto, temAudio: audio.tipo !== "nenhum", fotos: fotos.length });
  const dataOk = dataValida(data, hoje);

  async function gravar() {
    if (!suportaGravarAudio()) {
      mostrar(copy.semMicrofone);
      return;
    }
    try {
      setGravando(0);
      gravacao.current = await gravarAudio({
        onSegundo: setGravando,
        onFim: (g) => {
          gravacao.current = null;
          setGravando(null);
          setAudio({ tipo: "novo", blob: g.blob, segundos: g.segundos });
        },
      });
    } catch {
      setGravando(null);
      mostrar(copy.semMicrofone);
    }
  }

  async function adicionarFotos(arquivos: FileList | null) {
    if (!arquivos?.length) return;
    const livres = MAX_FOTOS - fotos.length;
    const novas: FotoDoEditor[] = [];
    for (const a of [...arquivos].slice(0, livres)) {
      try {
        novas.push({ tipo: "nova", id: novoId(), blob: (await processarFoto(a)).blob });
      } catch {
        /* foto ilegível: ignora as demais seguem */
      }
    }
    setFotos((l) => [...l, ...novas].slice(0, MAX_FOTOS));
    if (entradaFoto.current) entradaFoto.current.value = "";
  }

  async function salvar(semAudio = false) {
    setTocou(true);
    const audioFinal = semAudio ? { tipo: "nenhum" as const } : audio;
    if (!dataOk || !entradaValida({ body: texto, temAudio: audioFinal.tipo !== "nenhum", fotos: fotos.length })) return;
    // RN-06: a 11ª entrada com áudio no free abre o paywall; nada se perde.
    if (!semAudio && audio.tipo === "novo" && audioPassaDoLimite(entradas, eu, temPlano(perfil), existente)) {
      setPaywall(true);
      return;
    }
    setSalvando(true);
    try {
      const salva = await salvarEntrada(
        {
          milestone_code: marco?.code ?? null,
          body: texto,
          entry_date: data,
          audio: audioFinal.tipo === "novo" ? { blob: audioFinal.blob, segundos: audioFinal.segundos } : audioFinal.tipo === "nenhum" ? null : undefined,
          fotos,
        },
        eu,
        existente,
      );
      if (!existente) {
        track("diary_entry_created", { kind: salva.kind, milestone_code: salva.milestone_code, has_audio: Boolean(salva.audio_path), photos: fotos.length, source: usouDitado ? "dictation" : "text" });
      }
      mostrar(semAudio ? copy.salvaSemAudio : copy.salva);
      router.replace(`/diario/${salva.id}`);
    } catch {
      setSalvando(false);
    }
  }

  const podeSemAudio = Boolean(texto.trim()) || fotos.length > 0;

  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
      {marco && (
        <Card tom="acento">
          <p className="tipo-corpo text-texto">{perguntaDoMarco(marco, modoFe)}</p>
        </Card>
      )}

      <CampoArea
        rotulo={copy.campoTexto}
        semRotulo={Boolean(marco)}
        placeholder={parcial || copy.placeholderLivre}
        value={texto}
        maxLength={MAX_TEXTO}
        rows={6}
        onChange={(e) => setTexto(e.target.value)}
        acessorio={
          <BotaoDitado
            rotuloOuvir={copy.ditar}
            rotuloParar={copy.pararDitado}
            onParcial={setParcial}
            onTexto={(t) => {
              setParcial("");
              setUsouDitado(true);
              setTexto((atual) => (atual ? `${atual.trimEnd()} ${t}` : t).slice(0, MAX_TEXTO));
            }}
            onFalha={() => {
              // RN-05: se a transcrição falhar, grava só o áudio.
              mostrar(copy.ditadoFalhou);
              if (gravando === null && audio.tipo === "nenhum") void gravar();
            }}
          />
        }
      />

      <section aria-label={copy.audio}>
        <h2 className="tipo-titulo-secao mb-1.5 text-texto-mudo">{copy.audio}</h2>
        {gravando !== null ? (
          <div className="flex items-center gap-3 rounded-card bg-acento-suave px-4 py-2">
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-acento" />
            <span className="flex-1 text-[14px] text-texto" aria-live="polite">
              {copy.gravando(mmss(gravando))}
            </span>
            <Botao variant="secundario" icone={<Square size={14} fill="currentColor" aria-hidden />} onClick={() => gravacao.current?.parar()}>
              {copy.pararGravacao}
            </Botao>
          </div>
        ) : audio.tipo === "nenhum" ? (
          <Botao variant="secundario" icone={<Mic size={16} aria-hidden />} onClick={() => void gravar()}>
            {copy.gravar}
          </Botao>
        ) : (
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Audio rotulo={copy.audio} caminho={audio.tipo === "existente" ? audio.caminho : null} blob={audio.tipo === "novo" ? audio.blob : null} />
            </div>
            <button type="button" aria-label={copy.removerAudio} onClick={() => setAudio({ tipo: "nenhum" })} className="grid size-11 shrink-0 place-items-center rounded-pilula text-texto-mudo active:bg-primaria-suave">
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </section>

      <section aria-label={copy.fotosRotulo}>
        <h2 className="tipo-titulo-secao mb-1.5 text-texto-mudo">{copy.fotosRotulo}</h2>
        <input ref={entradaFoto} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" aria-label={copy.adicionarFoto} onChange={(e) => void adicionarFotos(e.target.files)} />
        <div className="grid grid-cols-3 gap-2">
          {fotos.map((f, i) => (
            <div key={f.tipo === "existente" ? f.foto.id : f.id} className="relative aspect-square overflow-hidden rounded-[12px] bg-fio">
              {f.tipo === "existente" ? <Foto caminho={f.foto.storage_path} alt={copy.removerFoto(i + 1)} /> : <MiniaturaNova blob={f.blob} alt={copy.removerFoto(i + 1)} />}
              <button type="button" aria-label={copy.removerFoto(i + 1)} onClick={() => setFotos((l) => l.filter((_, j) => j !== i))} className="absolute right-0 top-0 grid size-11 place-items-center text-superficie">
                <span className="grid size-7 place-items-center rounded-full bg-texto/60">
                  <X size={14} />
                </span>
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <button type="button" onClick={() => entradaFoto.current?.click()} className="grid aspect-square place-items-center rounded-[12px] border border-dashed border-fio text-primaria-texto" aria-label={copy.adicionarFoto}>
              <ImagePlus size={20} />
            </button>
          )}
        </div>
      </section>

      <CampoTexto rotulo={copy.data} type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} erro={tocou && !dataOk ? copy.dataFutura : undefined} />

      {tocou && !temConteudo && <p className="text-[13px] text-erro">{copy.vazia}</p>}

      <Botao largura="total" tamanho="lg" carregando={salvando} disabled={gravando !== null} onClick={() => void salvar()}>
        {copy.salvar}
      </Botao>

      {marco && !existente && (
        <div className="flex gap-2">
          <Botao
            largura="total"
            variant="secundario"
            onClick={() => {
              adiarMarco(eu, marco.code);
              track("diary_milestone_snoozed", { code: marco.code });
              mostrar(copy.adiado);
              router.replace("/diario");
            }}
          >
            {copy.maisTarde}
          </Botao>
          <Botao
            largura="total"
            variant="fantasma"
            onClick={() => {
              pularMarco(eu, marco.code);
              track("diary_milestone_skipped", { code: marco.code });
              mostrar(copy.pulado);
              router.replace("/diario");
            }}
          >
            {copy.pular}
          </Botao>
        </div>
      )}

      <SheetPaywall
        aberto={paywall}
        gatilho={{ feature: "diary", trigger: "audio_limit" }}
        onFechar={() => setPaywall(false)}
        alternativa={podeSemAudio ? { rotulo: copy.salvarSemAudio, onClick: () => void salvar(true) } : undefined}
      />
    </div>
  );
}
