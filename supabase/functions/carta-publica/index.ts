// Edge Function `carta-publica` (funcionalidade 14, RN-06). A página /carta/{token} do app chama aqui, sem login:
// o token é a autorização (só o hash dele fica no banco). Devolve só a carta (título, texto, áudio e foto por URL
// assinada de 1 hora), nada da gestação. Token desconhecido, vencido ou revogado → 404. Nunca entra em cache.
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders } from "../_shared/cors.ts";

const TOKEN = /^[a-f0-9]{64}$/;
const cabecalhos = { ...corsHeaders, "Access-Control-Allow-Methods": "GET, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cabecalhos });
  if (req.method !== "GET") return new Response(JSON.stringify({ erro: "método não permitido" }), { status: 405, headers: cabecalhos });
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!TOKEN.test(token)) return new Response(JSON.stringify({ erro: "não encontrada" }), { status: 404, headers: cabecalhos });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc("carta_por_token", { p_token: token });
  if (error) return new Response(JSON.stringify({ erro: "erro" }), { status: 500, headers: cabecalhos });
  const carta = (data ?? [])[0] as { title: string; body: string | null; audio_path: string | null; photo_path: string | null } | undefined;
  if (!carta) return new Response(JSON.stringify({ erro: "não encontrada" }), { status: 404, headers: cabecalhos });

  const assinada = async (caminho: string | null) => {
    if (!caminho) return null;
    const { data: u } = await sb.storage.from("ninho-privado").createSignedUrl(caminho, 3600);
    return u?.signedUrl ?? null;
  };
  const [audio, foto] = await Promise.all([assinada(carta.audio_path), assinada(carta.photo_path)]);
  return new Response(JSON.stringify({ titulo: carta.title, texto: carta.body, audio, foto }), { headers: cabecalhos });
});
