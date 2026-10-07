"use client";

import { ArrowLeft, Camera, FileText, Images, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { CampoArea } from "@/components/ui/CampoArea";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Escolha } from "@/components/ui/Escolha";
import { Foto } from "@/components/ui/Foto";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { galeriaCopy as copy } from "@/copy/galeria";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { userExams, type MedicalDocument } from "@/lib/dados/colecoes";
import { salvarDocumento, type PaginaDoForm } from "@/lib/galeria/acoes";
import { ErroDePagina, prepararPaginas } from "@/lib/galeria/paginas";
import { exameParaVincular, paginasDo, paginasGuardadas } from "@/lib/galeria/regras";
import { useGaleria } from "@/lib/galeria/useGaleria";
import { temPlano } from "@/lib/perfil";
import { nomeDoExame } from "@dominio/exames.ts";
import { cabeNoPlano, MAX_PAGINAS_DOCUMENTO, TIPOS_DOCUMENTO, validarData, type TipoDocumento } from "@dominio/galeria.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

type Origem = "camera" | "gallery" | "pdf";

interface Props {
  existente?: MedicalDocument;
  /** Spec 03 RN-08: "Anexar resultado agora?" chega com o exame e o tipo preenchidos. */
  exameId?: string | null;
  tipoInicial?: TipoDocumento | null;
}

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

/** Tela 2 "Adicionar" (e editar): câmera, galeria ou PDF, prévia das páginas, tipo, data, título e observação. */
export function FormDocumento({ existente, exameId, tipoInicial }: Props) {
  const { todos, paginas: todasPaginas, perfil, meuId, tz, hoje } = useGaleria();
  const exames = useColecao(userExams);
  const router = useRouter();
  const { mostrar } = useToast();
  const exame = exameId ? exames.find((e) => e.id === exameId && !e.apagado_em) : undefined;

  const [paginas, setPaginas] = useState<PaginaDoForm[]>(() => (existente ? paginasDo(existente.id, todasPaginas).map((pagina) => ({ tipo: "existente" as const, pagina })) : []));
  const [kind, setKind] = useState<TipoDocumento | null>(existente?.kind ?? tipoInicial ?? null);
  const [data, setData] = useState(() => {
    if (existente) return existente.exam_date;
    const marcado = exame?.scheduled_at ? dataNoFuso(new Date(exame.scheduled_at), tz) : null;
    return marcado && marcado < hoje ? marcado : hoje;
  });
  const [titulo, setTitulo] = useState(existente?.title ?? "");
  const [notas, setNotas] = useState(existente?.notes ?? "");
  const [origens, setOrigens] = useState<Set<Origem>>(new Set());
  const [preparando, setPreparando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tocou, setTocou] = useState(false);
  const [confirmarData, setConfirmarData] = useState(false);
  const [perguntarExame, setPerguntarExame] = useState<{ id: string; nome: string } | null>(null);
  const [paywall, setPaywall] = useState(false);
  // O sheet chama onConfirmar e depois onFechar: este ref separa o "Sim" do "Não".
  const respondeuSim = useRef(false);
  const gravando = useRef(false);
  const entradas = { camera: useRef<HTMLInputElement>(null), gallery: useRef<HTMLInputElement>(null), pdf: useRef<HTMLInputElement>(null) };

  useEffect(() => {
    if (!existente) track("exam_doc_add_started", {});
  }, [existente]);

  const validacao = validarData(data, hoje, perfil?.dpp);
  const novas = paginas.filter((p) => p.tipo === "nova").length;

  async function adicionar(arquivos: FileList | null, origem: Origem) {
    if (!arquivos?.length) return;
    setErro(null);
    setPreparando(true);
    try {
      const prontas = await prepararPaginas([...arquivos], paginas.length);
      setPaginas((l) => [...l, ...prontas.map((pagina) => ({ tipo: "nova" as const, pagina }))]);
      setOrigens((o) => new Set(o).add(origem));
    } catch (e) {
      const motivo = e instanceof ErroDePagina ? e.motivo : "ilegivel";
      setErro(motivo === "muitas_paginas" ? copy.muitasPaginas : motivo === "grande_demais" ? copy.grandeDemais : copy.ilegivel);
    } finally {
      setPreparando(false);
      for (const r of Object.values(entradas)) if (r.current) r.current.value = "";
    }
  }

  function mover(i: number) {
    if (i === 0) return;
    setPaginas((l) => {
      const c = [...l];
      [c[i - 1], c[i]] = [c[i]!, c[i - 1]!];
      return c;
    });
  }

  /** Etapas da RN-01 (data antiga), RN-02 (limite) e RN-04 (vínculo) antes de gravar. */
  function tentarSalvar(etapa: "data" | "plano" | "exame" | "gravar" = "data", vinculo: string | null = exame?.id ?? existente?.scheduled_exam_id ?? null) {
    setTocou(true);
    if (!kind || validacao.erro || !paginas.length) return;
    if (etapa === "data" && validacao.confirmar) return setConfirmarData(true);
    if ((etapa === "data" || etapa === "plano") && !cabeNoPlano(paginasGuardadas(todos, todasPaginas), novas, temPlano(perfil))) return setPaywall(true);
    if (etapa !== "gravar" && !vinculo) {
      const candidato = exameParaVincular(exames, kind, data);
      if (candidato) return setPerguntarExame({ id: candidato.id, nome: nomeDoExame(candidato) });
    }
    void gravar(vinculo);
  }

  async function gravar(vinculo: string | null) {
    if (!kind || gravando.current) return;
    gravando.current = true;
    setSalvando(true);
    try {
      const doc = await salvarDocumento({ kind, exam_date: data, title: titulo, notes: notas, scheduled_exam_id: vinculo }, paginas, meuId, existente);
      if (!existente) {
        const fonte = origens.size === 1 ? [...origens][0]! : origens.size > 1 ? "mixed" : "gallery";
        track("exam_doc_added", { kind, pages: paginas.length, source: fonte });
      }
      if (vinculo && vinculo !== existente?.scheduled_exam_id) {
        track("exam_doc_linked_to_exam", {});
        track("exam_marked_done", { with_document: true });
        const e = exames.find((x) => x.id === vinculo);
        mostrar(e ? copy.vinculado(nomeDoExame(e)) : copy.salvo);
      } else mostrar(copy.salvo);
      // RN-11: sem rede, volta para a galeria (já aberta, em cache) em vez de uma tela que ainda não carregou.
      router.replace(navigator.onLine ? `/galeria/${doc.id}` : "/galeria");
    } catch {
      gravando.current = false;
      setSalvando(false);
      setErro(copy.ilegivel);
    }
  }

  const botaoOrigem = (o: Origem, rotulo: string, Icone: typeof Camera) => (
    <Botao variant="secundario" icone={<Icone size={16} aria-hidden />} disabled={preparando || paginas.length >= MAX_PAGINAS_DOCUMENTO} onClick={() => entradas[o].current?.click()}>
      {paginas.length && o === "camera" ? copy.maisUmaPagina : rotulo}
    </Botao>
  );

  return (
    <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
      {exame && <p className="tipo-corpo text-primaria-texto">{copy.doExame(nomeDoExame(exame))}</p>}
      <input ref={entradas.camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void adicionar(e.target.files, "camera")} />
      <input ref={entradas.gallery} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void adicionar(e.target.files, "gallery")} />
      <input ref={entradas.pdf} type="file" accept="application/pdf" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void adicionar(e.target.files, "pdf")} />

      <section aria-label={copy.paginas(paginas.length)}>
        <p className="tipo-meta mb-2">{copy.origemApoio}</p>
        <div className="flex flex-wrap gap-2">
          {botaoOrigem("camera", copy.camera, Camera)}
          {botaoOrigem("gallery", copy.galeria, Images)}
          {botaoOrigem("pdf", copy.pdf, FileText)}
        </div>
        {preparando && <p className="tipo-meta mt-2" aria-live="polite">{copy.preparando}</p>}
        {erro && <p className="mt-2 text-[13px] text-erro">{erro}</p>}
        {tocou && !paginas.length && <p className="mt-2 text-[13px] text-erro">{copy.semPaginas}</p>}
        {paginas.length > 0 && (
          <ol className="mt-3 grid grid-cols-3 gap-2">
            {paginas.map((p, i) => (
              <li key={p.pagina.id} className="relative aspect-[3/4] overflow-hidden rounded-[12px] bg-fio">
                {p.tipo === "existente" ? <Foto caminho={p.pagina.storage_path} alt={copy.pagina(i + 1, paginas.length)} /> : <MiniaturaNova blob={p.pagina.blob} alt={copy.pagina(i + 1, paginas.length)} />}
                <span className="absolute bottom-1 left-1 rounded-pilula bg-texto/60 px-1.5 text-[11px] text-superficie">{i + 1}</span>
                <button type="button" aria-label={copy.removerPagina(i + 1)} onClick={() => setPaginas((l) => l.filter((_, j) => j !== i))} className="absolute right-0 top-0 grid size-11 place-items-center text-superficie">
                  <span className="grid size-7 place-items-center rounded-full bg-texto/60">
                    <X size={14} />
                  </span>
                </button>
                {i > 0 && (
                  <button type="button" aria-label={copy.moverAntes(i + 1)} onClick={() => mover(i)} className="absolute bottom-0 right-0 grid size-11 place-items-center text-superficie">
                    <span className="grid size-7 place-items-center rounded-full bg-texto/60">
                      <ArrowLeft size={14} />
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      <div>
        <Escolha rotulo={copy.tipo} opcoes={TIPOS_DOCUMENTO.map((t) => ({ valor: t, rotulo: copy.tipos[t] }))} valor={kind ?? ("" as TipoDocumento)} onMudar={setKind} />
        {tocou && !kind && <p className="mt-1.5 text-[12px] text-erro">{copy.tipoErro}</p>}
      </div>
      <CampoTexto
        rotulo={copy.data}
        type="date"
        value={data}
        max={hoje}
        onChange={(e) => setData(e.target.value)}
        erro={tocou && validacao.erro ? (validacao.erro === "futura" ? copy.dataFutura : copy.dataErro) : undefined}
      />
      <CampoTexto rotulo={copy.titulo_} value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} autoComplete="off" />
      <CampoArea rotulo={copy.observacao} value={notas} maxLength={1000} rows={3} onChange={(e) => setNotas(e.target.value)} />

      <Botao largura="total" tamanho="lg" carregando={salvando} disabled={preparando} onClick={() => tentarSalvar()}>
        {copy.salvar}
      </Botao>

      <SheetConfirmar
        aberto={confirmarData}
        titulo={copy.dataAntigaTitulo}
        texto={copy.dataAntigaTexto}
        confirmar={copy.dataAntigaSim}
        cancelar={copy.cancelar}
        onFechar={() => setConfirmarData(false)}
        onConfirmar={() => tentarSalvar("plano")}
      />
      <SheetConfirmar
        aberto={perguntarExame !== null}
        titulo={perguntarExame ? copy.vincularTitulo(perguntarExame.nome) : ""}
        texto={copy.vincularTexto}
        confirmar={copy.vincularSim}
        cancelar={copy.vincularNao}
        onFechar={() => {
          // "Não" (ou fechar o sheet): grava sem vínculo.
          const sim = respondeuSim.current;
          respondeuSim.current = false;
          if (perguntarExame && !sim) void gravar(null);
          setPerguntarExame(null);
        }}
        onConfirmar={() => {
          respondeuSim.current = true;
          if (perguntarExame) void gravar(perguntarExame.id);
        }}
      />
      {/* RN-02: no envio da 21ª página o documento não é salvo; nada do que já está guardado some. */}
      <SheetPaywall aberto={paywall} gatilho={{ feature: "exam_gallery", trigger: "pages_limit" }} onFechar={() => setPaywall(false)} />
    </div>
  );
}
