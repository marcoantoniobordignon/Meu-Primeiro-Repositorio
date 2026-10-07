"use client";

import { novoId } from "@/lib/dados/colecao";
import { avisos, convites, membros, type Convite, type Membro } from "@/lib/dados/colecoes";
import { gerarToken, PERMISSOES_PARCEIRO_PADRAO, parceiroAtivo } from "@/lib/familia/regras";
import {
  aceitarConviteParceiroRemoto,
  criarConviteParceiroRemoto,
  erroDoConvite,
  lerConviteParceiro,
  revogarConviteParceiroRemoto,
  sairDaGestacaoRemoto,
  temServidor,
  type ErroConviteParceiro,
} from "@/lib/familia/servidor";
import { atualizarPerfil } from "@/lib/perfil";
import { estadoConviteParceiro, gerarCodigo, normalizarCodigo, VALIDADE_CONVITE_PARCEIRO_DIAS, type EstadoConviteParceiro } from "@dominio/parceiro.ts";

/**
 * Funcionalidade 12 · convite do parceiro. Com servidor, pelas RPCs (o token nunca é guardado lá);
 * sem servidor, o mesmo fluxo vive neste aparelho (útil para testar e para quem ainda não conectou).
 */
export interface ConviteGerado {
  token: string;
  code: string;
  expires_at: string;
}

export class ErroConvite extends Error {
  constructor(public motivo: ErroConviteParceiro) {
    super(motivo);
  }
}

/** O último convite gerado neste aparelho (para mostrar link e código enquanto valer). */
const CHAVE_ULTIMO = "ninho.convite-parceiro";

export function ultimoConviteGerado(): ConviteGerado | null {
  try {
    const bruto = localStorage.getItem(CHAVE_ULTIMO);
    return bruto ? (JSON.parse(bruto) as ConviteGerado) : null;
  } catch {
    return null;
  }
}

function guardarUltimo(c: ConviteGerado | null) {
  try {
    if (c) localStorage.setItem(CHAVE_ULTIMO, JSON.stringify(c));
    else localStorage.removeItem(CHAVE_ULTIMO);
  } catch {
    /* nada */
  }
}

const deParceiroAtivos = (l: Convite[]) => l.filter((c) => c.papel === "parceiro" && !c.usado_em && !c.revogado_em);

/** RN-01/03: só a gestante; um ativo por vez (gerar outro revoga o anterior); 7 dias. */
export async function gerarConviteParceiro(eu: string, lista: Membro[], agora = new Date()): Promise<ConviteGerado> {
  if (parceiroAtivo(lista)) throw new ErroConvite("ja_tem_parceiro");
  let gerado: ConviteGerado;
  if (temServidor()) {
    try {
      gerado = await criarConviteParceiroRemoto();
    } catch (e) {
      throw new ErroConvite(erroDoConvite(e));
    }
  } else {
    for (const c of deParceiroAtivos(convites.listar())) convites.salvar({ ...c, revogado_em: agora.toISOString() });
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    gerado = { token: gerarToken(), code: gerarCodigo(bytes), expires_at: new Date(agora.getTime() + VALIDADE_CONVITE_PARCEIRO_DIAS * 86_400_000).toISOString() };
    convites.salvar({ id: novoId(), token: gerado.token, code: gerado.code, papel: "parceiro", criado_por: eu, expira_em: gerado.expires_at });
  }
  guardarUltimo(gerado);
  return gerado;
}

export async function revogarConviteParceiro(agora = new Date()): Promise<void> {
  if (temServidor()) await revogarConviteParceiroRemoto();
  for (const c of deParceiroAtivos(convites.listar())) convites.salvar({ ...c, revogado_em: agora.toISOString() });
  guardarUltimo(null);
}

function acharLocal(chave: { token?: string; code?: string }): Convite | undefined {
  const codigo = chave.code ? normalizarCodigo(chave.code) : null;
  return convites.listar().find((c) => c.papel === "parceiro" && ((chave.token && c.token === chave.token) || (codigo && c.code === codigo)));
}

function estadoLocal(c: Convite | undefined, agora: Date): EstadoConviteParceiro {
  return estadoConviteParceiro(c ? { expires_at: c.expira_em, accepted_at: c.usado_em, revoked_at: c.revogado_em } : null, agora);
}

export interface VistaConvite {
  estado: EstadoConviteParceiro;
  quem: string;
}

export async function lerConvite(chave: { token?: string; code?: string }, agora = new Date()): Promise<VistaConvite> {
  if (temServidor()) {
    const c = await lerConviteParceiro(chave);
    return { estado: c?.estado ?? "inexistente", quem: c?.quem ?? "Alguém" };
  }
  const c = acharLocal(chave);
  return { estado: estadoLocal(c, agora), quem: membros.listarTodos().find((m) => m.profile_id === c?.criado_por)?.nome ?? "Alguém" };
}

/** RN-02: com servidor, exige conta (não anônima) e um papel por conta; o servidor confere tudo. */
export async function aceitarConvite(chave: { token?: string; code?: string }, eu: string, nome: string | null, agora = new Date()): Promise<{ horas: number }> {
  if (temServidor()) {
    try {
      const r = await aceitarConviteParceiroRemoto(chave, nome);
      atualizarPerfil({ papel: "parceiro", ...(nome ? { nome } : {}) });
      return { horas: Number(r.horas) || 0 };
    } catch (e) {
      throw new ErroConvite(erroDoConvite(e));
    }
  }
  const c = acharLocal(chave);
  const estado = estadoLocal(c, agora);
  if (estado !== "valido" || !c) throw new ErroConvite(estado === "valido" ? "inexistente" : estado);
  if (parceiroAtivo(membros.listar())) throw new ErroConvite("ja_tem_parceiro");
  const existente = membros.listarTodos().find((m) => m.profile_id === eu);
  membros.salvar({
    id: existente?.id ?? novoId(),
    profile_id: eu,
    nome: nome || existente?.nome || "Parceiro",
    papel: "parceiro",
    convidado_por: c.criado_por,
    ultimo_acesso_em: agora.toISOString(),
    permissoes: PERMISSOES_PARCEIRO_PADRAO,
    apagado_em: null,
  });
  convites.salvar({ ...c, usado_por: eu, usado_em: agora.toISOString() });
  atualizarPerfil({ papel: "parceiro", ...(nome ? { nome } : {}) });
  return { horas: Math.round(((agora.getTime() - (new Date(c.expira_em).getTime() - VALIDADE_CONVITE_PARCEIRO_DIAS * 86_400_000)) / 3_600_000) * 10) / 10 };
}

/** RN-06: ele sai; o diário fica com ela. Sem servidor, o aviso da central nasce aqui. */
export async function sairDaGestacao(eu: string, agora = new Date()): Promise<void> {
  if (temServidor()) await sairDaGestacaoRemoto();
  const minha = membros.listar().find((m) => m.profile_id === eu);
  if (minha) membros.salvar({ ...minha, apagado_em: agora.toISOString() });
  if (!temServidor()) {
    const gestante = membros.listar().find((m) => m.papel === "mae");
    if (gestante) avisos.salvar({ id: novoId(), para: gestante.profile_id, tipo: "partner_left", titulo: `${minha?.nome ?? "Seu parceiro"} saiu da gestação`, corpo: "O que ele escreveu no diário continua com você.", url: "/eu/parceiro", lido_em: null, criado_em: agora.toISOString() });
  }
  atualizarPerfil({ papel: "mae" });
}

export function estadoDoUltimo(c: ConviteGerado | null, agora = new Date()): EstadoConviteParceiro {
  if (!c) return "inexistente";
  const local = acharLocal({ token: c.token });
  if (local) return estadoLocal(local, agora);
  return estadoConviteParceiro({ expires_at: c.expires_at }, agora);
}
