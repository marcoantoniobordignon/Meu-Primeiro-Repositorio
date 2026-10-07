"use client";

import { useEffect, useState } from "react";

import { aoEscrever } from "@/lib/dados/colecao";
import { artigosRemotos, canaisRemotos, cartoesRemotos, oracoesRemotas, conteudosRemotos, faqVerbetes, membros, userExams, type ArtigoRemoto, type CanalRemoto, type CartaoRemoto, type OracaoRemota, type FaqVerbete, type Membro, type Papel } from "@/lib/dados/colecoes";
import type { PermissoesParceiro } from "@/lib/familia/regras";
import { aoMudarPerfil, atualizarPerfil, perfilAtual, type Perfil } from "@/lib/perfil";
import { sincronizarArquivos } from "@/lib/arquivos/arquivos";
import { enviarContadores } from "@/lib/fe/contadores";
import { migrarConsultasAntigas } from "@/lib/consultas-acoes";
import { garantirSessaoAnonima, sessaoAtual, sincronizarSessao } from "@/lib/sessao";
import { chamarRpc, supabase, supabaseConfigurado, tabela, type Cliente } from "@/lib/supabase/client";
import type { NomeTabela } from "@/lib/supabase/types.generated";

import { mapeamentoDaColecao, mapeamentos, paraServidor } from "./mapa";
import { assinarOutbox, concluir, enfileirar, falhou, pendentes, prontos, temPendenteAntigo, type ItemOutbox } from "./outbox";

const CHAVE_ULTIMA = "ninho.sync.ultima";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let iniciado = false;
let rodando = false;
let timer: number | null = null;
const ouvintes = new Set<() => void>();
let estado = { online: true, pendentes: 0, pendenteAntigo: false, sincronizando: false, remoto: false };

function avisar(mudancas: Partial<typeof estado>) {
  estado = { ...estado, ...mudancas };
  ouvintes.forEach((cb) => cb());
}

function lerUltima(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CHAVE_ULTIMA) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function guardarUltima(u: Record<string, string>) {
  try {
    localStorage.setItem(CHAVE_ULTIMA, JSON.stringify(u));
  } catch {
    /* nada */
  }
}

/** Registros criados com uid local (sem rede) não podem levar criado_por: o servidor preenche. */
function limparAutor(payload: Record<string, unknown>): Record<string, unknown> {
  const p = { ...payload };
  if (typeof p.criado_por === "string" && !UUID.test(p.criado_por)) delete p.criado_por;
  return p;
}

async function contarPendentes() {
  const lista = await pendentes();
  avisar({ pendentes: lista.length, pendenteAntigo: temPendenteAntigo(lista) });
}

/** Envia o que está pronto na outbox (ARQ-01), na ordem, com backoff por item. */
export async function empurrar(sb: Cliente): Promise<void> {
  const lista = prontos(await pendentes());
  for (const item of lista) {
    try {
      await enviarItem(sb, item);
      await concluir(item);
    } catch (e) {
      await falhou(item, e instanceof Error ? e.message : String(e));
    }
  }
}

async function enviarItem(sb: Cliente, item: ItemOutbox) {
  const conflito = mapeamentos.find((m) => m.tabela === item.tabela)?.conflito ?? "id";
  const { error } = await tabela(sb, item.tabela).upsert(limparAutor(item.payload), { onConflict: conflito });
  if (error) {
    // 23505 = violação de unique (ex.: o mesmo sintoma do dia criado em dois aparelhos): o servidor já tem; descarta.
    if (error.code === "23505") return;
    throw new Error(error.message);
  }
}

/** Puxa o que mudou no servidor desde a última vez e mescla por atualizado_em (ARQ-02). */
export async function puxar(sb: Cliente): Promise<void> {
  const ultima = lerUltima();
  for (const m of mapeamentos) {
    const desde = ultima[m.tabela] ?? "1970-01-01T00:00:00Z";
    const { data, error } = await tabela(sb, m.tabela).select("*").gt("atualizado_em", desde).order("atualizado_em", { ascending: true }).limit(1000);
    if (error || !data) continue;
    const linhas = data as { id: string; atualizado_em: string }[];
    m.colecao.mesclar((m.doServidor ? linhas.map((l) => m.doServidor!(l)) : linhas) as never);
    const maior = linhas[linhas.length - 1]?.atualizado_em;
    if (maior) ultima[m.tabela] = maior;
  }
  await puxarConteudos(sb, ultima);
  await puxarFaq(sb, ultima);
  await puxarArtigos(sb, ultima);
  await puxarOracoes(sb, ultima);
  await puxarDireitos(sb, ultima);
  guardarUltima(ultima);
  await puxarViradas(sb);
  await puxarFamilia(sb);
}

/** Conteúdo editado no painel: a RLS já filtra o publicado; mescla por atualizado_em. */
async function puxarConteudos(sb: Cliente, ultima: Record<string, string>): Promise<void> {
  const desde = ultima.conteudos ?? "1970-01-01T00:00:00Z";
  const { data, error } = await tabela(sb, "conteudos").select("*").gt("atualizado_em", desde).order("atualizado_em", { ascending: true }).limit(1000);
  if (error || !data) return;
  const linhas = data as { id: string; atualizado_em: string }[];
  conteudosRemotos.mesclar(linhas as never);
  const maior = linhas[linhas.length - 1]?.atualizado_em;
  if (maior) ultima.conteudos = maior;
}

/**
 * Funcionalidade 09 RN-10: o que é publicado fica no aparelho (busca e leitura offline). Um verbete
 * revisado chega com o texto novo pelo `atualizado_em`; o arquivado sai da lista.
 */
async function puxarFaq(sb: Cliente, ultima: Record<string, string>): Promise<void> {
  const desde = ultima.faq_foods ?? "1970-01-01T00:00:00Z";
  const { data, error } = await tabela(sb, "faq_foods").select("*").gt("atualizado_em", desde).order("atualizado_em", { ascending: true }).limit(1000);
  if (error || !data) return;
  const linhas = data as unknown as FaqVerbete[];
  faqVerbetes.mesclar(linhas.map((v) => ({ ...v, apagado_em: v.status === "published" ? null : v.atualizado_em })));
  const maior = linhas[linhas.length - 1]?.atualizado_em;
  if (maior) ultima.faq_foods = maior;
}

/** Funcionalidade 11: artigos publicados ficam no aparelho (leitura offline); o arquivado sai da lista. */
async function puxarArtigos(sb: Cliente, ultima: Record<string, string>): Promise<void> {
  const desde = ultima.articles ?? "1970-01-01T00:00:00Z";
  const { data, error } = await tabela(sb, "articles").select("*").gt("atualizado_em", desde).order("atualizado_em", { ascending: true }).limit(1000);
  if (error || !data) return;
  const linhas = data as unknown as ArtigoRemoto[];
  artigosRemotos.mesclar(linhas.map((a) => ({ ...a, apagado_em: a.status === "published" ? null : a.atualizado_em })));
  const maior = linhas[linhas.length - 1]?.atualizado_em;
  if (maior) ultima.articles = maior;
}

/**
 * Funcionalidade 17 RN-11: todas as orações publicadas ficam no aparelho, com o modo ligado ou não
 * (ligar o modo nunca abre uma biblioteca vazia).
 */
async function puxarOracoes(sb: Cliente, ultima: Record<string, string>): Promise<void> {
  const desde = ultima.faith_prayers ?? "1970-01-01T00:00:00Z";
  const { data, error } = await tabela(sb, "faith_prayers").select("*").gt("atualizado_em", desde).order("atualizado_em", { ascending: true }).limit(1000);
  if (error || !data) return;
  const linhas = data as unknown as OracaoRemota[];
  oracoesRemotas.mesclar(linhas.map((o) => ({ ...o, apagado_em: o.status === "published" ? null : o.atualizado_em })));
  const maior = linhas[linhas.length - 1]?.atualizado_em;
  if (maior) ultima.faith_prayers = maior;
}

/** Funcionalidade 16 RN-10: cartões e canais ficam no aparelho; despublicado ou desativado sai da lista. */
async function puxarDireitos(sb: Cliente, ultima: Record<string, string>): Promise<void> {
  const cartoes = await tabela(sb, "rights_cards").select("*").gt("atualizado_em", ultima.rights_cards ?? "1970-01-01T00:00:00Z").order("atualizado_em", { ascending: true }).limit(1000);
  if (!cartoes.error && cartoes.data) {
    const linhas = cartoes.data as unknown as CartaoRemoto[];
    cartoesRemotos.mesclar(linhas.map((c) => ({ ...c, apagado_em: c.status === "published" ? null : c.atualizado_em })));
    const maior = linhas[linhas.length - 1]?.atualizado_em;
    if (maior) ultima.rights_cards = maior;
  }
  const canais = await tabela(sb, "help_channels").select("*").gt("atualizado_em", ultima.help_channels ?? "1970-01-01T00:00:00Z").order("atualizado_em", { ascending: true }).limit(100);
  if (!canais.error && canais.data) {
    const linhas = canais.data as unknown as CanalRemoto[];
    canaisRemotos.mesclar(linhas.map((c) => ({ ...c, apagado_em: c.active ? null : c.atualizado_em })));
    const maior = linhas[linhas.length - 1]?.atualizado_em;
    if (maior) ultima.help_channels = maior;
  }
}

/** Funcionalidade 11 RN-06: a virada vista em outro aparelho não aparece de novo neste. */
async function puxarViradas(sb: Cliente): Promise<void> {
  const s = sessaoAtual();
  if (!s?.remota) return;
  const { data } = await tabela(sb, "profiles").select("t2_seen_at, t3_seen_at").eq("id", s.uid).limit(1);
  const v = (data?.[0] ?? null) as { t2_seen_at: string | null; t3_seen_at: string | null } | null;
  const p = perfilAtual();
  if (!v || !p) return;
  const mudar: Partial<Perfil> = {};
  if (v.t2_seen_at && !p.t2VistoEm) mudar.t2VistoEm = v.t2_seen_at;
  if (v.t3_seen_at && !p.t3VistoEm) mudar.t3VistoEm = v.t3_seen_at;
  if (Object.keys(mudar).length) atualizarPerfil(mudar);
}

/** Plano, cortesia e papel são da família (CUI-06); membros vêm com nome pela RPC. */
async function puxarFamilia(sb: Cliente): Promise<void> {
  const [{ data: fam }, { data: lista }] = await Promise.all([
    chamarRpc<{ papel: string; plano: string; cortesia_fim: string | null; dpp: string | null }[]>(sb, "minha_familia"),
    chamarRpc<{ profile_id: string; nome: string | null; papel: string; convidado_por: string | null; ultimo_acesso_em: string; permissoes: PermissoesParceiro | null; removido_em: string | null }[]>(sb, "meus_membros"),
  ]);
  const f = fam?.[0];
  if (f) {
    atualizarPerfil({
      papel: f.papel as Papel,
      plano: (f.plano === "expirado" ? "free" : f.plano) as Perfil["plano"],
      cortesiaFim: f.cortesia_fim,
      // Funcionalidade 12: quem acompanha vê a semana dela (a DPP é da gestante).
      ...(f.papel !== "mae" && f.dpp ? { dpp: f.dpp } : {}),
    });
  }
  const atuais = membros.listarTodos();
  for (const l of lista ?? []) {
    const existente = atuais.find((m) => m.profile_id === l.profile_id);
    const registro: Membro = {
      id: existente?.id ?? l.profile_id,
      profile_id: l.profile_id,
      nome: l.nome ?? "Alguém",
      papel: l.papel as Papel,
      convidado_por: l.convidado_por,
      ultimo_acesso_em: l.ultimo_acesso_em,
      permissoes: l.permissoes ?? {},
      atualizado_em: new Date().toISOString(),
      // RN-06: quem saiu fica (apagado) só para o "Escrito por {nome}".
      apagado_em: l.removido_em,
    };
    membros.mesclar([registro]);
  }
  if (f?.papel === "parceiro") await puxarExamesDoParceiro(sb);
}

/**
 * Funcionalidade 12 RN-04: o parceiro não lê `user_exams`; os marcados chegam só com nome e data
 * e substituem a cópia local (o que ela desmarcou some daqui).
 */
async function puxarExamesDoParceiro(sb: Cliente): Promise<void> {
  const { data, error } = await chamarRpc<{ id: string; catalog_code: string | null; custom_name: string | null; scheduled_at: string | null; scheduled_all_day: boolean; atualizado_em: string }[]>(sb, "exames_marcados_parceiro");
  if (error || !data) return;
  const agora = new Date().toISOString();
  const vivos = new Set(data.map((e) => e.id));
  const sairam = userExams.listarTodos().filter((e) => !vivos.has(e.id) && !e.apagado_em).map((e) => ({ ...e, apagado_em: agora, atualizado_em: agora }));
  userExams.mesclar([
    ...sairam,
    ...data.map((e) => ({
      id: e.id,
      catalog_code: e.catalog_code,
      custom_name: e.custom_name,
      status: "scheduled" as const,
      window_start_date: null,
      window_end_date: null,
      past_window: false,
      window_start_week: null,
      window_end_week: null,
      scheduled_at: e.scheduled_at,
      scheduled_all_day: e.scheduled_all_day,
      location: null,
      notes: null,
      done_on: null,
      document_id: null,
      atualizado_em: e.atualizado_em,
      apagado_em: null,
    })),
  ]);
}

/** Sessão local (criada sem rede) vira remota; registros com autor local ganham o uid real. */
async function promoverSessao(): Promise<boolean> {
  const antes = sessaoAtual();
  const depois = await garantirSessaoAnonima();
  if (!depois.remota) return false;
  if (antes && !antes.remota) {
    for (const m of mapeamentos) {
      for (const r of m.colecao.listarTodos()) {
        if (r.criado_por === antes.uid) m.colecao.mesclar([{ ...r, criado_por: depois.uid, atualizado_em: new Date(Date.now() + 1).toISOString() }]);
      }
    }
    const eu = membros.listarTodos().find((x) => x.profile_id === antes.uid);
    if (eu) membros.mesclar([{ ...eu, profile_id: depois.uid, atualizado_em: new Date(Date.now() + 1).toISOString() }]);
  }
  return true;
}

/** Quem precisa reagir ao que chegou do servidor (doses, exames) se registra aqui. */
const aposSincronizar = new Set<() => void>();
export function aoSincronizar(cb: () => void): () => void {
  aposSincronizar.add(cb);
  return () => aposSincronizar.delete(cb);
}

export async function sincronizar(): Promise<void> {
  if (rodando || !supabaseConfigurado() || typeof navigator !== "undefined" && !navigator.onLine) return;
  const sb = await supabase();
  if (!sb) return;
  rodando = true;
  avisar({ sincronizando: true });
  try {
    const remota = await promoverSessao();
    avisar({ remoto: remota });
    if (!remota) return;
    await empurrar(sb);
    // Arquivos depois das linhas: a policy do Storage exige a linha que referencia o arquivo.
    await sincronizarArquivos(sb);
    await puxar(sb);
    // Funcionalidade 17 RN-10: contadores anônimos acumulados no aparelho.
    await enviarContadores();
    aposSincronizar.forEach((cb) => cb());
  } catch {
    /* tenta de novo no próximo ciclo */
  } finally {
    rodando = false;
    avisar({ sincronizando: false });
    void contarPendentes();
  }
}

export function enfileirarPerfil(p: Perfil) {
  const s = sessaoAtual();
  if (!s?.remota) return;
  void enfileirar("profiles", {
    id: s.uid,
    nome: p.nome ?? null,
    modo: p.modo,
    dpp: p.dpp ?? null,
    bebe_ativo_id: p.bebeAtivoId ?? null,
    telefone_equipe: p.telefoneEquipe ?? null,
    onboarding_concluido_em: p.onboardingConcluidoEm,
    ...(p.tz ? { tz: p.tz } : {}),
    prefs: p.prefs ?? {},
    consents: p.consents ?? {},
    // Só manda o que já foi visto: nunca apaga a virada vista em outro aparelho.
    ...(p.t2VistoEm ? { t2_seen_at: p.t2VistoEm } : {}),
    ...(p.t3VistoEm ? { t3_seen_at: p.t3VistoEm } : {}),
    ultimo_acesso_em: new Date().toISOString(),
    atualizado_em: new Date().toISOString(),
  });
}

/** Liga a sincronização uma vez por sessão do navegador. Sem Supabase, não faz nada. */
export function iniciarSincronizacao() {
  if (iniciado || typeof window === "undefined") return;
  iniciado = true;
  // Funcionalidade 04: a antiga `consultas` vira `appointments` antes de qualquer envio.
  const migracao = migrarConsultasAntigas().catch(() => 0);
  avisar({ online: navigator.onLine, remoto: sessaoAtual()?.remota ?? false });
  void contarPendentes();
  assinarOutbox(() => void contarPendentes());
  window.addEventListener("online", () => {
    avisar({ online: true });
    void sincronizar();
  });
  window.addEventListener("offline", () => avisar({ online: false }));
  if (!supabaseConfigurado()) return;

  // Toda escrita local vai para a outbox com o nome da tabela.
  aoEscrever((chave, registro) => {
    const m = mapeamentoDaColecao(chave);
    if (m) void enfileirar(m.tabela as NomeTabela, paraServidor(registro, m.soLocal));
  });
  aoMudarPerfil(enfileirarPerfil);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void sincronizar();
  });
  void supabase().then((sb) =>
    sb?.auth.onAuthStateChange(() => {
      void sincronizarSessao().then(() => sincronizar());
    }),
  );
  timer = window.setInterval(() => void sincronizar(), 60_000);
  void migracao.then(() => sincronizar());
}

export function pararSincronizacao() {
  if (timer) window.clearInterval(timer);
  timer = null;
  iniciado = false;
}

/** Estado para a faixa de rede (ARQ-04) e o aviso de pendências antigas. */
export function useEstadoRede() {
  const [s, setS] = useState(estado);
  useEffect(() => {
    const cb = () => setS(estado);
    ouvintes.add(cb);
    cb();
    return () => {
      ouvintes.delete(cb);
    };
  }, []);
  return s;
}
