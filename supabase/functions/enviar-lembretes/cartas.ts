// Funcionalidade 14 · parte do job `enviar-lembretes`: tira do Storage o áudio e a foto de cartas excluídas (RN-08),
// abre as lacradas às 06:00 locais (RN-05), avisa a autora (push `letter_open` + e-mail), entrega por e-mail com o
// link de leitura (RN-06) e manda o e-mail anual no aniversário do nascimento (RN-11).
// deno-lint-ignore-file no-explicit-any
import type { createClient } from "npm:@supabase/supabase-js@2";

import { enviarEmail } from "../_shared/email.ts";
import { abrirAgora, DIAS_DO_LINK, ehAniversario } from "../_shared/dominio/cartas.ts";
import { prefsCompletas } from "../_shared/dominio/prefs.ts";
import { dataNoFuso, fusoOuPadrao, horaNoFuso } from "../_shared/dominio/tempo.ts";
import { textosLembretes as t } from "../_shared/dominio/textos-lembretes.ts";

type Cliente = ReturnType<typeof createClient<any>>;
type Empurrar = (profileId: string, carga: { titulo: string; corpo: string; url: string; tag: string; categoria: string }) => Promise<void>;

const APP_URL = (Deno.env.get("APP_URL") ?? "").replace(/\/$/, "");

async function sha256(texto: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function tokenNovo(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function emailDe(sb: Cliente, profileId: string): Promise<string | null> {
  const { data } = await sb.auth.admin.getUserById(profileId);
  return data?.user?.email ?? null;
}

export async function processarCartas(sb: Cliente, agora: Date, empurrar: Empurrar): Promise<{ abertas: number; emails: number }> {
  const resumo = { abertas: 0, emails: 0 };

  // RN-08: excluída → áudio e foto saem do Storage.
  const { data: limpar } = await sb.from("letters").select("id, audio_path, photo_path").eq("storage_cleanup_pending", true).limit(200);
  for (const c of limpar ?? []) {
    const caminhos = [c.audio_path, c.photo_path].filter(Boolean) as string[];
    const { error } = caminhos.length ? await sb.storage.from("ninho-privado").remove(caminhos) : { error: null };
    if (!error) await sb.from("letters").update({ audio_path: null, audio_seconds: null, photo_path: null, storage_cleanup_pending: false }).eq("id", c.id);
  }

  // RN-05: abre no fuso da autora, a partir das 06:00 do dia.
  const amanha = new Date(agora.getTime() + 86_400_000).toISOString().slice(0, 10);
  const { data: lacradas } = await sb
    .from("letters")
    .select("id, open_on, status, apagado_em, profiles!letters_author_id_fkey(tz)")
    .eq("status", "sealed")
    .is("apagado_em", null)
    .lte("open_on", amanha)
    .limit(500);
  for (const c of lacradas ?? []) {
    const p = (Array.isArray(c.profiles) ? c.profiles[0] : c.profiles) as { tz?: string } | null;
    const tz = fusoOuPadrao(p?.tz ?? "");
    if (!abrirAgora(c as any, dataNoFuso(agora, tz), horaNoFuso(agora, tz))) continue;
    const { data: aberta } = await sb.from("letters").update({ status: "opened", opened_at: agora.toISOString(), atualizado_em: agora.toISOString() }).eq("id", c.id).eq("status", "sealed").select("id");
    if (aberta?.length) resumo.abertas++;
  }

  // Avisos da abertura (uma vez cada): push e e-mail para a autora; e-mail com o link para o destinatário.
  const { data: abertas } = await sb
    .from("letters")
    .select("id, familia_id, author_id, title, delivery_email, opened_notified_at, delivery_sent_at")
    .eq("status", "opened")
    .is("apagado_em", null)
    .or("opened_notified_at.is.null,and(delivery_email.not.is.null,delivery_sent_at.is.null)")
    .limit(200);
  for (const c of abertas ?? []) {
    try {
      if (!c.opened_notified_at) {
        await empurrar(c.author_id, { titulo: t.carta.pushTitulo, corpo: t.carta.pushCorpo(c.title), url: `/cartas/ler?id=${c.id}`, tag: `letter:${c.id}`, categoria: "letter" });
        const email = await emailDe(sb, c.author_id);
        if (email && (await enviarEmail({ para: email, assunto: t.carta.emailAutoraAssunto(c.title), texto: t.carta.emailAutoraTexto(c.title, `${APP_URL}/cartas/ler?id=${c.id}`) }))) resumo.emails++;
        await sb.from("letters").update({ opened_notified_at: agora.toISOString() }).eq("id", c.id);
      }
      if (c.delivery_email && !c.delivery_sent_at && APP_URL) {
        const token = tokenNovo();
        await sb.from("letter_share_tokens").update({ revoked_at: agora.toISOString() }).eq("letter_id", c.id).is("revoked_at", null);
        await sb.from("letter_share_tokens").insert({ letter_id: c.id, token_hash: await sha256(token), expires_at: new Date(agora.getTime() + DIAS_DO_LINK * 86_400_000).toISOString() });
        const { data: fam } = await sb.from("familias").select("baby_name").eq("id", c.familia_id).maybeSingle();
        const ok = await enviarEmail({ para: c.delivery_email, assunto: t.carta.emailEntregaAssunto(fam?.baby_name ?? ""), texto: t.carta.emailEntregaTexto(c.title, `${APP_URL}/carta/${token}`) });
        // letter_delivery_email_sent: o registro é delivery_sent_at (sem analytics no servidor).
        if (ok) {
          await sb.from("letters").update({ delivery_sent_at: agora.toISOString() }).eq("id", c.id);
          resumo.emails++;
        }
      }
    } catch (e) {
      console.error("carta", c.id, e instanceof Error ? e.message : e);
    }
  }

  // RN-11: no aniversário do nascimento (09:00 locais), um e-mail por ano para quem tem carta lacrada.
  const { data: autores } = await sb.from("letters").select("familia_id, author_id").eq("status", "sealed").is("apagado_em", null).limit(5000);
  const vistos = new Set<string>();
  for (const a of autores ?? []) {
    const chaveAutor = `${a.familia_id}:${a.author_id}`;
    if (vistos.has(chaveAutor)) continue;
    vistos.add(chaveAutor);
    try {
      const [{ data: bebe }, { data: perfil }, { data: fam }] = await Promise.all([
        sb.from("bebes").select("nascido_em").eq("familia_id", a.familia_id).is("apagado_em", null).order("nascido_em").limit(1).maybeSingle(),
        sb.from("profiles").select("tz, prefs").eq("id", a.author_id).maybeSingle(),
        sb.from("familias").select("baby_name").eq("id", a.familia_id).maybeSingle(),
      ]);
      if (!bebe || !perfil) continue;
      const tz = fusoOuPadrao(perfil.tz ?? "");
      const hoje = dataNoFuso(agora, tz);
      if (!prefsCompletas(perfil.prefs).letters_annual_email || horaNoFuso(agora, tz) < "09:00") continue;
      if (!ehAniversario(dataNoFuso(new Date(bebe.nascido_em), tz), hoje)) continue;
      const chave = `letter_annual:${a.author_id}:${hoje.slice(0, 4)}`;
      const { data: ja } = await sb.from("reminders_sent").select("chave").eq("familia_id", a.familia_id).eq("chave", chave).maybeSingle();
      if (ja) continue;
      const email = await emailDe(sb, a.author_id);
      if (!email) continue;
      const nome = fam?.baby_name ?? "";
      if (await enviarEmail({ para: email, assunto: t.carta.emailAnualAssunto(nome), texto: t.carta.emailAnualTexto(nome, `${APP_URL}/cartas`) })) {
        await sb.from("reminders_sent").insert({ familia_id: a.familia_id, chave, categoria: "letter", tipo: "letter_annual", ref: a.author_id, essencial: false, enviado_em: agora.toISOString() });
        resumo.emails++;
      }
    } catch (e) {
      console.error("e-mail anual", e instanceof Error ? e.message : e);
    }
  }
  return resumo;
}
