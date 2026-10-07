// Edge Function `acao-lembrete` (funcionalidade 02 RN-05/06): "Tomei" e "Adiar" tocados na
// notificação, com o app fechado. O service worker manda o token assinado pelo job; sem rede,
// o app aplica a mesma ação depois (store `acoes_push`), e as duas escritas convergem.
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, json } from "../_shared/cors.ts";
import { ADIAR_MS, MAX_ADIAMENTOS } from "../_shared/dominio/medicamentos.ts";
import { verificarToken } from "../_shared/dominio/token.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ erro: "método" }, 405);
  const corpo = (await req.json().catch(() => null)) as { token?: string; acao?: string; quando?: string } | null;
  const carga = corpo?.token ? await verificarToken(corpo.token, Deno.env.get("LEMBRETES_SEGREDO") ?? "") : null;
  if (!carga || (corpo?.acao !== "tomei" && corpo?.acao !== "adiar")) return json({ erro: "token inválido" }, 401);

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: dose } = await sb.from("medication_doses").select("*").eq("id", carga.dose).eq("familia_id", carga.familia).maybeSingle();
  if (!dose || dose.status !== "pending" || dose.apagado_em) return json({ ok: true, ignorado: true });

  const agora = new Date();
  const quando = corpo.quando && !Number.isNaN(Date.parse(corpo.quando)) && Date.parse(corpo.quando) <= agora.getTime() ? corpo.quando : agora.toISOString();
  const mudanca =
    corpo.acao === "tomei"
      ? { status: "taken", taken_at: quando, source: "push" }
      : (dose.snooze_count ?? 0) < MAX_ADIAMENTOS
        ? { snooze_count: (dose.snooze_count ?? 0) + 1, snoozed_until: new Date(agora.getTime() + ADIAR_MS).toISOString() }
        : null;
  if (!mudanca) return json({ ok: true, ignorado: true });
  const { error } = await sb.from("medication_doses").update({ ...mudanca, atualizado_em: agora.toISOString() }).eq("id", carga.dose).eq("status", "pending");
  return error ? json({ erro: error.message }, 500) : json({ ok: true });
});
