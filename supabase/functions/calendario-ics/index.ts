// Edge Function `calendario-ics` (funcionalidade 08, RN-08). O app publica em {APP_URL}/ics/{token}.ics
// (rewrite do Next para cá). O token é a autorização: sem JWT. Revogado ou desconhecido → 404, e o
// calendário externo deixa de atualizar. Cache de 15 minutos. Só consultas, exames marcados, eventos
// próprios e DPP; nunca medicamentos, fotos nem notas (`calendar_items_v`).
import { createClient } from "npm:@supabase/supabase-js@2";

import { gerarIcs, type ItemIcs } from "../_shared/dominio/calendario.ts";
import { exameDoCatalogo } from "../_shared/dominio/exames.ts";

const TOKEN = /^[a-f0-9]{48}$/;

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("método não permitido", { status: 405 });
  const url = new URL(req.url);
  const bruto = url.searchParams.get("arquivo") ?? url.searchParams.get("token") ?? url.pathname.split("/").pop() ?? "";
  const token = bruto.replace(/\.ics$/, "");
  if (!TOKEN.test(token)) return new Response("não encontrado", { status: 404 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: feed } = await sb.from("calendar_feed_tokens").select("familia_id").eq("token", token).is("revoked_at", null).maybeSingle();
  if (!feed) return new Response("não encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });

  const { data: linhas, error } = await sb.from("calendar_items_v").select("item_type, item_id, title, location, starts_at, all_day, all_day_date").eq("familia_id", feed.familia_id);
  if (error) return new Response("erro", { status: 500 });

  const itens: ItemIcs[] = (linhas ?? []).map((l) => ({
    item_type: l.item_type as ItemIcs["item_type"],
    item_id: l.item_type === "edd" ? "dpp" : (l.item_id as string),
    title: l.item_type === "exam" ? (exameDoCatalogo(l.title as string)?.name ?? (l.title as string)) : (l.title as string),
    location: (l.location as string | null) ?? null,
    starts_at: (l.starts_at as string | null) ?? null,
    all_day: Boolean(l.all_day),
    all_day_date: (l.all_day_date as string | null) ?? null,
  }));
  return new Response(req.method === "HEAD" ? null : gerarIcs(itens, new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="ninho.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
});
