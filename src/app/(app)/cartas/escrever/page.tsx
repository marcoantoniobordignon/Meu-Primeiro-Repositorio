"use client";

import { ImagePlus, Lock, Mic, Square, Trash2, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Audio } from "@/components/ui/Audio";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Foto } from "@/components/ui/Foto";
import { Sheet } from "@/components/ui/Sheet";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { cartasCopy as copy } from "@/copy/cartas";
import { track } from "@/lib/analytics";
import { ErroCarta, excluir, lacrar, salvarRascunho, type MotivoLacre } from "@/lib/cartas/acoes";
import { useCartas } from "@/lib/cartas/useCartas";
import { formatarComAno } from "@/lib/dates";
import { useFuso } from "@/lib/hooks/useFuso";
import { gravarAudio, suportaGravarAudio, type Gravacao } from "@/lib/midia/audio";
import { processarFoto } from "@/lib/midia/imagem";
import { dataNoFuso } from "@dominio/tempo.ts";
import { dataDeAbertura, erroAoLacrar, limitesDaDataPropria, MAX_AUDIO_S, MAX_TEXTO, MAX_TITULO, podeCriarCarta, REGRAS_ABERTURA, type ErroCarta as Erro, type RegraAbertura } from "@dominio/cartas.ts";

type AudioEditor = { tipo: "nenhum" } | { tipo: "salvo"; caminho: string; segundos: number } | { tipo: "novo"; blob: Blob; segundos: number };
type FotoEditor = { tipo: "nenhuma" } | { tipo: "salva"; caminho: string } | { tipo: "nova"; blob: Blob };

/** Prévia da foto recém-escolhida (ainda não guardada). */
function PreviaFoto({ blob, alt }: { blob: Blob; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  // eslint-disable-next-line @next/next/no-img-element -- blob local; next/image não otimiza blob
  return url ? <img src={url} alt={alt} className="aspect-square w-full rounded-card object-cover" /> : null;
}

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const tz = useFuso();
  const { mostrar } = useToast();
  const { perfil, cartas, premium, nomeDoBebe, referencia, nascido } = useCartas();
  const [id, setId] = useState<string | null>(params.get("id"));
  const existente = id ? cartas.find((c) => c.id === id) : undefined;
  const [carregado, setCarregado] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [regra, setRegra] = useState<RegraAbertura | null>(null);
  const [custom, setCustom] = useState("");
  const [email, setEmail] = useState("");
  const [audio, setAudio] = useState<AudioEditor>({ tipo: "nenhum" });
  const [foto, setFoto] = useState<FotoEditor>({ tipo: "nenhuma" });
  const [gravando, setGravando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<"letter_limit" | "letter_media" | null>(null);
  const [lacrando, setLacrando] = useState(false);
  const [erroLacre, setErroLacre] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [apagando, setApagando] = useState(false);
  const gravacao = useRef<Gravacao | null>(null);
  const entradaFoto = useRef<HTMLInputElement>(null);
  const hoje = dataNoFuso(new Date(), tz);

  // Carrega o rascunho uma vez; lacrada ou aberta vai para a leitura.
  useEffect(() => {
    if (carregado) return;
    if (id && !existente) return;
    if (existente && existente.status !== "draft") {
      router.replace(`/cartas/ler?id=${existente.id}`);
      return;
    }
    if (existente) {
      setTitulo(existente.title);
      setTexto(existente.body ?? "");
      setRegra(existente.open_rule);
      setCustom(existente.custom_open_on ?? "");
      setEmail(existente.delivery_email ?? "");
      if (existente.audio_path && existente.audio_seconds) setAudio({ tipo: "salvo", caminho: existente.audio_path, segundos: existente.audio_seconds });
      if (existente.photo_path) setFoto({ tipo: "salva", caminho: existente.photo_path });
    } else if (!podeCriarCarta(cartas.length, premium)) {
      setPaywall("letter_limit");
    }
    setCarregado(true);
  }, [carregado, existente, id, cartas.length, premium, router]);
  useEffect(() => () => gravacao.current?.cancelar(), []);

  if (!perfil) return null;
  const nome = nomeDoBebe ?? copy.bebe;
  const abre = dataDeAbertura(regra, referencia, custom || null);
  const limites = limitesDaDataPropria(hoje);
  const mensagem = (e: Erro | "carta_lacrada") => copy.editor.erros[e];

  async function gravar() {
    if (!premium) return setPaywall("letter_media");
    if (!suportaGravarAudio()) return mostrar(copy.lacre.erros.desconhecido);
    try {
      setGravando(0);
      gravacao.current = await gravarAudio(
        {
          onSegundo: setGravando,
          onFim: (g) => {
            gravacao.current = null;
            setGravando(null);
            setAudio({ tipo: "novo", blob: g.blob, segundos: g.segundos });
          },
        },
        MAX_AUDIO_S,
      );
    } catch {
      setGravando(null);
    }
  }

  async function escolherFoto(arquivos: FileList | null) {
    const a = arquivos?.[0];
    if (!a) return;
    try {
      setFoto({ tipo: "nova", blob: (await processarFoto(a)).blob });
    } catch {
      /* foto ilegível */
    }
    if (entradaFoto.current) entradaFoto.current.value = "";
  }

  async function salvar(): Promise<string | null> {
    setErro(null);
    try {
      const nova = !id;
      const c = await salvarRascunho({
        id: id ?? undefined,
        title: titulo,
        body: texto,
        open_rule: regra,
        custom_open_on: custom || null,
        delivery_email: email,
        audio: audio.tipo === "novo" ? { blob: audio.blob, segundos: audio.segundos } : audio.tipo === "nenhum" ? null : undefined,
        foto: foto.tipo === "nova" ? foto.blob : foto.tipo === "nenhuma" ? null : undefined,
      });
      if (audio.tipo === "novo" && c.audio_path) setAudio({ tipo: "salvo", caminho: c.audio_path, segundos: c.audio_seconds ?? audio.segundos });
      if (foto.tipo === "nova" && c.photo_path) setFoto({ tipo: "salva", caminho: c.photo_path });
      if (nova) {
        track("letter_draft_created", {});
        setId(c.id);
        router.replace(`/cartas/escrever?id=${c.id}`);
      }
      return c.id;
    } catch (e) {
      setErro(e instanceof ErroCarta ? mensagem(e.message as Erro) : copy.lacre.erros.desconhecido);
      return null;
    }
  }

  async function abrirLacre() {
    const e = erroAoLacrar({ title: titulo, body: texto, audio_path: audio.tipo === "nenhum" ? null : "x", open_rule: regra, custom_open_on: custom || null, delivery_email: email || null }, hoje);
    if (e) return setErro(mensagem(e));
    if (await salvar()) {
      setErroLacre(null);
      setLacrando(true);
    }
  }

  async function confirmarLacre() {
    if (!id) return;
    setEnviando(true);
    setErroLacre(null);
    try {
      await lacrar(id);
      track("letter_sealed", { open_rule: regra ?? "", has_audio: audio.tipo !== "nenhum" });
      mostrar(copy.lacre.pronto);
      setLacrando(false);
      router.push(`/cartas/ler?id=${id}`);
    } catch (e) {
      setErroLacre(copy.lacre.erros[(e instanceof ErroCarta ? e.message : "desconhecido") as MotivoLacre] ?? copy.lacre.erros.desconhecido);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <Cabecalho titulo={id ? copy.editor.editar : copy.editor.novo} voltarPara="/cartas" />
      <form
        className="flex flex-col gap-4 px-5 pb-8 pt-1"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar().then((ok) => ok && mostrar(navigator.onLine ? copy.editor.salvo : copy.editor.salvoOffline));
        }}
      >
        <p className="tipo-meta">{copy.para(nome)}</p>
        <CampoTexto rotulo={copy.editor.titulo} placeholder={copy.editor.tituloPlaceholder} value={titulo} maxLength={MAX_TITULO} onChange={(e) => setTitulo(e.target.value)} />
        <CampoArea rotulo={copy.editor.texto} placeholder={copy.editor.textoPlaceholder} value={texto} maxLength={MAX_TEXTO} rows={10} onChange={(e) => setTexto(e.target.value)} />

        <Card>
          <div className="flex flex-col gap-3">
            {audio.tipo !== "nenhum" ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Audio rotulo={copy.editor.audio} caminho={audio.tipo === "salvo" ? audio.caminho : null} blob={audio.tipo === "novo" ? audio.blob : null} />
                </div>
                <button type="button" aria-label={copy.editor.removerAudio} onClick={() => setAudio({ tipo: "nenhum" })} className="grid size-11 place-items-center rounded-pilula text-texto-mudo">
                  <X size={18} />
                </button>
              </div>
            ) : gravando !== null ? (
              <Botao variant="secundario" icone={<Square size={16} aria-hidden />} onClick={() => gravacao.current?.parar()}>
                {copy.editor.parar} · {Math.floor(gravando / 60)}:{String(gravando % 60).padStart(2, "0")}
              </Botao>
            ) : (
              <div>
                <Botao variant="secundario" icone={<Mic size={16} aria-hidden />} onClick={() => void gravar()}>
                  {copy.editor.audio}
                </Botao>
                <p className="tipo-meta mt-1">{premium ? copy.editor.audioApoio : copy.editor.premium}</p>
              </div>
            )}
            {foto.tipo !== "nenhuma" ? (
              <div className="flex items-start gap-2">
                <div className="w-32">
                  {foto.tipo === "salva" ? <Foto caminho={foto.caminho} alt={copy.editor.foto} /> : <PreviaFoto blob={foto.blob} alt={copy.editor.foto} />}
                </div>
                <button type="button" aria-label={copy.editor.removerFoto} onClick={() => setFoto({ tipo: "nenhuma" })} className="grid size-11 place-items-center rounded-pilula text-texto-mudo">
                  <X size={18} />
                </button>
              </div>
            ) : (
              <Botao variant="secundario" icone={<ImagePlus size={16} aria-hidden />} onClick={() => (premium ? entradaFoto.current?.click() : setPaywall("letter_media"))}>
                {copy.editor.foto}
              </Botao>
            )}
            <input ref={entradaFoto} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void escolherFoto(e.target.files)} />
          </div>
        </Card>

        <Escolha
          rotulo={copy.editor.regra}
          valor={regra ?? ""}
          onMudar={(v) => setRegra((v || null) as RegraAbertura | null)}
          opcoes={REGRAS_ABERTURA.map((r) => ({ valor: r, rotulo: copy.editor.regras[r] }))}
        />
        {regra === "custom" && (
          <div>
            <CampoTexto rotulo={copy.editor.dataPropria} type="date" value={custom} min={limites.min} max={limites.max} onChange={(e) => setCustom(e.target.value)} />
            <p className="tipo-meta mt-1">{copy.editor.dataPropriaApoio(formatarComAno(limites.min), formatarComAno(limites.max))}</p>
          </div>
        )}
        {abre && (
          <p className="tipo-meta" aria-live="polite">
            {copy.editor.abririaEm(formatarComAno(abre))} {regra !== "custom" && !nascido && copy.editor.abririaEmDpp}
          </p>
        )}

        <div>
          <CampoTexto rotulo={copy.editor.email} type="email" inputMode="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="tipo-meta mt-1">{copy.editor.emailApoio}</p>
        </div>

        {erro && (
          <p className="tipo-corpo text-erro" role="alert">
            {erro}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Botao type="submit" largura="total" variant="secundario">
            {copy.editor.salvar}
          </Botao>
          <Botao largura="total" tamanho="lg" icone={<Lock size={16} aria-hidden />} onClick={() => void abrirLacre()}>
            {copy.editor.lacrar}
          </Botao>
          {id && (
            <Botao largura="total" variant="fantasma" icone={<Trash2 size={16} aria-hidden />} onClick={() => setApagando(true)}>
              {copy.editor.excluir}
            </Botao>
          )}
        </div>
      </form>

      {/* Tela 3 "Lacrar": confirmação com o resumo da data. */}
      <Sheet aberto={lacrando} onFechar={() => setLacrando(false)} titulo={copy.lacre.titulo}>
        <p className="text-[17px] font-medium text-texto">{abre ? copy.lacre.resumo(formatarComAno(abre)) : ""}</p>
        <p className="tipo-corpo mt-2 text-texto-mudo">{copy.lacre.aviso}</p>
        {erroLacre && (
          <p className="tipo-corpo mt-3 text-erro" role="alert">
            {erroLacre}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <Botao largura="total" variant="secundario" onClick={() => setLacrando(false)}>
            {copy.lacre.cancelar}
          </Botao>
          <Botao largura="total" disabled={enviando} onClick={() => void confirmarLacre()}>
            {copy.lacre.confirmar}
          </Botao>
        </div>
      </Sheet>
      <SheetConfirmar
        aberto={apagando}
        titulo={copy.excluir.titulo}
        texto={copy.excluir.texto}
        confirmar={copy.excluir.confirmar}
        cancelar={copy.excluir.cancelar}
        onFechar={() => setApagando(false)}
        onConfirmar={() => {
          if (!id) return;
          void excluir(id).then(() => {
            mostrar(copy.excluir.pronto);
            router.replace("/cartas");
          });
        }}
      />
      <SheetPaywall
        aberto={paywall !== null}
        gatilho={{ feature: "letters", trigger: paywall ?? "letter_limit" }}
        onFechar={() => {
          const eraLimite = paywall === "letter_limit";
          setPaywall(null);
          if (eraLimite) router.replace("/cartas");
        }}
      />
    </div>
  );
}

/** Tela 2 "Escrever": título, texto, áudio e foto (Completo), regra de abertura e destinatário. */
export default function PaginaEscreverCarta() {
  return (
    <Suspense>
      <Conteudo />
    </Suspense>
  );
}
