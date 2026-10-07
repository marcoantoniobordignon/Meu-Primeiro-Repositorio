// Edge Function `ler-laudo` (funcionalidade 01, RN-05..08). Só roda quando a gestante toca em
// "Ler laudo": confere sessão, papel, plano, consentimento e cota; manda as páginas ao modelo e
// grava a transcrição validada. Falha ou JSON inválido vira `failed` sem gastar cota (RN-07).
//
// Deploy: `supabase functions deploy ler-laudo`; segredos: ANTHROPIC_API_KEY e, opcional, MODELO_LAUDO.
// Server-side fallbacks ligados: se o modelo principal recusar, a própria API refaz no modelo recomendado.
import Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, json } from "../_shared/cors.ts";
import {
  consentimentoValido,
  cotaRestante,
  COTA_IA_MES,
  ESQUEMA_RESUMO,
  familiaTemPlano,
  INSTRUCOES_LEITURA,
  janelaDaCota,
  validarResumo,
} from "../_shared/dominio/galeria.ts";
import { fusoOuPadrao } from "../_shared/dominio/tempo.ts";

// Decisão em aberto (Pietro): provedor e modelo. Padrão: o Opus atual, trocável por segredo.
const MODELO = Deno.env.get("MODELO_LAUDO") ?? "claude-opus-5-5";
const BUCKET = "ninho-privado";
const BYTES_IMAGEM_MAX = 3_750_000; // ~5 MB em base64, o limite por imagem da API
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const agora = new Date();

  const auth = req.headers.get("Authorization") ?? "";
  const comoEla = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: usuario } = await comoEla.auth.getUser();
  const uid = usuario.user?.id;
  if (!uid) return json({ erro: "sem sessão" }, 401);

  let corpo: { document_id?: unknown; consentido_em?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "corpo inválido" }, 400);
  }
  const docId = typeof corpo.document_id === "string" && UUID.test(corpo.document_id) ? corpo.document_id : null;
  if (!docId) return json({ erro: "document_id inválido" }, 400);

  // A RLS decide se ela enxerga o documento; daqui em diante, service role.
  const { data: doc } = await comoEla.from("medical_documents").select("id, familia_id, ai_status").eq("id", docId).is("apagado_em", null).maybeSingle();
  if (!doc) return json({ erro: "documento não encontrado" }, 404);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const familia = doc.familia_id as string;

  const [membro, fam, perfil] = await Promise.all([
    sb.from("membros_familia").select("papel").eq("familia_id", familia).eq("profile_id", uid).maybeSingle(),
    sb.from("familias").select("plano, trial_fim, cortesia_fim").eq("id", familia).single(),
    sb.from("profiles").select("tz, consents").eq("id", uid).single(),
  ]);
  if (membro.data?.papel !== "mae") return json({ erro: "só a gestante" }, 403);
  if (!fam.data || !familiaTemPlano(fam.data, agora)) return json({ status: "premium" });

  // RN-05: consentimento da própria pessoa. O "sim" pode chegar antes da sincronização do perfil.
  const consents = (perfil.data?.consents ?? {}) as Record<string, unknown>;
  const gravado = (consents.ai_document_reading as { given_at?: unknown } | null | undefined)?.given_at;
  if (!consentimentoValido(gravado, agora)) {
    if (!consentimentoValido(corpo.consentido_em, agora)) return json({ status: "sem_consentimento" });
    await sb.from("profiles").update({ consents: { ...consents, ai_document_reading: { given_at: corpo.consentido_em } } }).eq("id", uid);
  }

  // RN-08: 20 leituras bem-sucedidas por mês civil no fuso dela.
  const tz = fusoOuPadrao(perfil.data?.tz as string | null);
  const janela = janelaDaCota(agora, tz);
  const { count } = await sb.from("ai_document_reads").select("id", { count: "exact", head: true }).eq("familia_id", familia).eq("ok", true).gte("criado_em", janela.inicio.toISOString());
  if ((count ?? 0) >= COTA_IA_MES) return json({ status: "sem_cota", renova: janela.renova.toISOString() });

  // As páginas precisam ter subido. Sem elas não é falha da leitura: nada muda.
  const { data: paginas } = await sb.from("document_pages").select("storage_path, mime").eq("document_id", docId).is("apagado_em", null).order("position");
  if (!paginas?.length) return json({ status: "aguardando" });
  const imagens: Anthropic.ImageBlockParam[] = [];
  for (const p of paginas) {
    const { data: arq, error } = await sb.storage.from(BUCKET).download(p.storage_path as string);
    if (error || !arq) return json({ status: "aguardando" });
    const bytes = new Uint8Array(await arq.arrayBuffer());
    if (bytes.length > BYTES_IMAGEM_MAX) return await falhou(sb, docId, familia, "imagem grande demais");
    imagens.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64(bytes) } });
  }

  await sb.from("medical_documents").update({ ai_status: "pending", atualizado_em: new Date().toISOString() }).eq("id", docId);

  let resumo = null;
  try {
    const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
    const stream = anthropic.beta.messages.stream({
      model: MODELO,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: INSTRUCOES_LEITURA,
      output_config: { format: { type: "json_schema", schema: ESQUEMA_RESUMO } },
      messages: [{ role: "user", content: [...imagens, { type: "text", text: `Transcreva este laudo (${imagens.length} página${imagens.length > 1 ? "s" : ""}).` }] }],
    });
    const resposta = await stream.finalMessage();
    if (resposta.stop_reason === "end_turn") {
      const texto = resposta.content.find((b) => b.type === "text");
      resumo = texto && texto.type === "text" ? validarResumo(JSON.parse(texto.text)) : null;
    } else console.error("ler-laudo: stop_reason", resposta.stop_reason);
  } catch (e) {
    console.error("ler-laudo:", e instanceof Error ? e.message : e);
  }
  if (!resumo) return await falhou(sb, docId, familia, "resposta inválida");

  const quando = new Date().toISOString();
  await sb.from("medical_documents").update({ ai_status: "done", ai_summary: resumo, atualizado_em: quando }).eq("id", docId);
  await sb.from("ai_document_reads").insert({ familia_id: familia, document_id: docId, ok: true });
  return json({ status: "done", ai_summary: resumo, restantes: cotaRestante((count ?? 0) + 1), atualizado_em: quando });
});

// deno-lint-ignore no-explicit-any
type Cliente = ReturnType<typeof createClient<any>>;

/** RN-07: `failed`, o arquivo continua salvo e a cota não muda (a linha `ok=false` é só registro). */
async function falhou(sb: Cliente, docId: string, familia: string, motivo: string): Promise<Response> {
  console.error("ler-laudo: falhou", motivo);
  const quando = new Date().toISOString();
  await sb.from("medical_documents").update({ ai_status: "failed", atualizado_em: quando }).eq("id", docId);
  await sb.from("ai_document_reads").insert({ familia_id: familia, document_id: docId, ok: false });
  return json({ status: "failed", atualizado_em: quando });
}
