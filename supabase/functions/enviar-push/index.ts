// Edge Function `enviar-push` (spec 13). Nesta versão só valida o JWT e responde;
// a assinatura Web Push, as preferências e os limites (2 por dia, silêncio na cortesia)
// entram com a spec 13.
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, json } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data } = await sb.auth.getUser();
  if (!data.user) return json({ erro: "sem sessão" }, 401);
  return json({ ok: true, enviado: false, motivo: "spec 13 pendente" });
});
