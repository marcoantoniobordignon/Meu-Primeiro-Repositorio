"use client";

import { algumPendente, esquecerArquivoLocal, esquecerPastaLocal, extensaoDoMime, guardarArquivo, lerArquivo } from "@/lib/arquivos/arquivos";
import { novoId } from "@/lib/dados/colecao";
import { cartas, type Carta } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";
import { temServidor } from "@/lib/familia/servidor";
import { pendentes } from "@/lib/offline/outbox";
import { sincronizar } from "@/lib/offline/sync";
import { chamarRpc, supabase, supabaseConfigurado } from "@/lib/supabase/client";
import { erroAoSalvar, exportavel, MAX_AUDIO_S, nomeDeArquivo, type RegraAbertura } from "@dominio/cartas.ts";

import { montarZip, type ArquivoZip } from "./zip";

export class ErroCarta extends Error {}

export interface Rascunho {
  id?: string;
  title: string;
  body: string;
  open_rule: RegraAbertura | null;
  custom_open_on: string | null;
  delivery_email: string;
  /** undefined = mantém; null = remove; objeto = novo. */
  audio?: { blob: Blob; segundos: number } | null;
  foto?: Blob | null;
}

const sufixo = () => Math.random().toString(36).slice(2, 8);

/** Só as minhas (RN-09): o servidor já filtra; aqui, as escritas deste aparelho. */
export function minhasCartas(): Carta[] {
  return cartas.listar().filter((c) => !c.criado_por || c.criado_por === meuId());
}

/**
 * RN-01: salva o rascunho (sem rede também: vai pela fila). Áudio e foto ficam no aparelho e sobem depois da carta
 * (`cartas/{id}/...`, o caminho que o banco aceita). Devolve a carta salva.
 */
export async function salvarRascunho(r: Rascunho): Promise<Carta> {
  const erro = erroAoSalvar({ title: r.title, body: r.body, delivery_email: r.delivery_email || null });
  if (erro) throw new ErroCarta(erro);
  const id = r.id ?? novoId();
  const anterior = cartas.listarTodos().find((c) => c.id === id);
  if (anterior && anterior.status !== "draft") throw new ErroCarta("carta_lacrada");
  let audio_path = anterior?.audio_path ?? null;
  let audio_seconds = anterior?.audio_seconds ?? null;
  let photo_path = anterior?.photo_path ?? null;
  const antigos: (string | null)[] = [];
  if (r.audio === null) {
    antigos.push(audio_path);
    audio_path = null;
    audio_seconds = null;
  } else if (r.audio) {
    antigos.push(audio_path);
    audio_path = `cartas/${id}/audio-${sufixo()}.${extensaoDoMime(r.audio.blob.type)}`;
    audio_seconds = Math.min(MAX_AUDIO_S, Math.max(1, Math.round(r.audio.segundos)));
    await guardarArquivo(audio_path, r.audio.blob);
  }
  if (r.foto === null) {
    antigos.push(photo_path);
    photo_path = null;
  } else if (r.foto) {
    antigos.push(photo_path);
    photo_path = `cartas/${id}/foto-${sufixo()}.jpg`;
    await guardarArquivo(photo_path, r.foto);
  }
  const salva = cartas.salvar({
    id,
    title: r.title.trim(),
    body: r.body.trim() ? r.body : null,
    audio_path,
    audio_seconds,
    photo_path,
    open_rule: r.open_rule,
    custom_open_on: r.open_rule === "custom" ? r.custom_open_on : null,
    open_on: null,
    status: "draft",
    delivery_email: r.delivery_email.trim() || null,
    created_at: anterior?.created_at ?? new Date().toISOString(),
    criado_por: meuId(),
    apagado_em: null,
  });
  for (const c of antigos) await esquecerArquivoLocal(c);
  return salva;
}

/** O que impede lacrar agora (precisa de servidor, rede e tudo já enviado). */
export type MotivoLacre = "sem_servidor" | "sem_rede" | "pendente" | "sem_conteudo" | "data_invalida" | "sem_referencia" | "desconhecido";

async function cliente() {
  if (!supabaseConfigurado()) throw new ErroCarta("sem_servidor");
  if (!temServidor()) throw new ErroCarta("sem_rede");
  const sb = await supabase();
  if (!sb) throw new ErroCarta("sem_rede");
  return sb;
}

function traduzir(m: string | undefined): MotivoLacre {
  const conhecidos: [RegExp, MotivoLacre][] = [
    [/nao_sincronizado|arquivo_pendente/, "pendente"],
    [/sem_conteudo/, "sem_conteudo"],
    [/data_invalida/, "data_invalida"],
    [/sem_referencia/, "sem_referencia"],
  ];
  return conhecidos.find(([re]) => re.test(m ?? ""))?.[1] ?? "desconhecido";
}

/**
 * RN-03: lacrar exige conexão. Sobe a carta e os arquivos, confere que nada ficou na fila e pede ao banco; lacrada,
 * o texto, o áudio e a foto saem também deste aparelho (só título e data ficam).
 */
export async function lacrar(id: string): Promise<string> {
  const sb = await cliente();
  await sincronizar();
  const local = cartas.listarTodos().find((c) => c.id === id);
  if (!local) throw new ErroCarta("desconhecido");
  const naFila = (await pendentes()).some((i) => i.tabela === "letters" && i.payload.id === id);
  if (naFila || (await algumPendente([local.audio_path, local.photo_path]))) throw new ErroCarta("pendente");
  const { data, error } = await chamarRpc<string>(sb, "lacrar_carta", { p_id: id, p_atualizado_em: local.atualizado_em });
  if (error || !data) throw new ErroCarta(traduzir(error?.message));
  // Sempre mais novo que a última edição local (senão o mesclar ignora e o texto ficaria no aparelho).
  const agora = new Date(Math.max(Date.now(), Date.parse(local.atualizado_em) + 1)).toISOString();
  cartas.mesclar([{ ...local, status: "sealed", open_on: data, sealed_at: agora, body: null, audio_path: null, audio_seconds: null, photo_path: null, atualizado_em: agora }]);
  await esquecerArquivoLocal(local.audio_path);
  await esquecerArquivoLocal(local.photo_path);
  return data;
}

/** RN-04: desfazer o lacre (o app já pediu as duas confirmações); o conteúdo volta do servidor. */
export async function deslacrar(id: string): Promise<Carta> {
  const sb = await cliente();
  const { data, error } = await chamarRpc<Carta[]>(sb, "deslacrar_carta", { p_id: id });
  const linha = data?.[0];
  if (error || !linha) throw new ErroCarta("desconhecido");
  cartas.mesclar([linha]);
  return linha;
}

/** Lacradas (ou excluídas) que chegaram de outro aparelho: os arquivos delas também saem deste. */
export async function esquecerArquivosDeLacradas(): Promise<number> {
  let n = 0;
  for (const c of cartas.listarTodos().filter((x) => x.status === "sealed" || x.apagado_em)) n += await esquecerPastaLocal(`cartas/${c.id}/`);
  return n;
}

/** RN-08: excluir é definitivo (a lacrada pode ser excluída sem ser lida). */
export async function excluir(id: string): Promise<void> {
  const c = cartas.listarTodos().find((x) => x.id === id);
  cartas.apagar(id);
  await esquecerArquivoLocal(c?.audio_path);
  await esquecerArquivoLocal(c?.photo_path);
}

/** RN-06: link de leitura (só carta aberta). */
export async function criarLink(id: string): Promise<string> {
  const sb = await cliente();
  const { data, error } = await chamarRpc<string>(sb, "criar_link_carta", { p_id: id });
  if (error || !data) throw new ErroCarta("desconhecido");
  return `${window.location.origin}/carta/${data}`;
}

export async function revogarLink(id: string): Promise<void> {
  const sb = await cliente();
  const { error } = await chamarRpc(sb, "revogar_link_carta", { p_id: id });
  if (error) throw new ErroCarta("desconhecido");
}

/** RN-10: ZIP com texto, áudio e foto de rascunhos e abertas; das lacradas, nada. */
export async function exportar(lista: Carta[]): Promise<{ blob: Blob; cartas: number }> {
  const enc = new TextEncoder();
  const arquivos: ArquivoZip[] = [];
  const escolhidas = lista.filter(exportavel);
  const usados = new Set<string>();
  for (const c of escolhidas) {
    let pasta = nomeDeArquivo(c.title, "x").replace(/\.x$/, "");
    for (let n = 2; usados.has(pasta); n++) pasta = `${nomeDeArquivo(c.title, "x").replace(/\.x$/, "")}-${n}`;
    usados.add(pasta);
    arquivos.push({ nome: `${pasta}/carta.txt`, dados: enc.encode(`${c.title}\n\n${c.body ?? ""}\n`) });
    for (const caminho of [c.audio_path, c.photo_path]) {
      if (!caminho) continue;
      const blob = await lerArquivo(caminho);
      if (blob) arquivos.push({ nome: `${pasta}/${caminho.split("/").pop()}`, dados: new Uint8Array(await blob.arrayBuffer()) });
    }
  }
  const zip = montarZip(arquivos);
  return { blob: new Blob([zip.buffer as ArrayBuffer], { type: "application/zip" }), cartas: escolhidas.length };
}
