// Edge Function `enviar-lembretes` (funcionalidades 02–06). Roda a cada minuto (Cron do Supabase,
// ver README) com o segredo LEMBRETES_SEGREDO no header Authorization.
// Para cada gestante: mantém as doses (job diário do modelo, idempotente), planeja os lembretes
// a partir do estado atual e manda por Web Push só o que venceu agora (`selecionarParaEnvio`),
// registrando em `reminders_sent`. Toda a regra mora em ../_shared/dominio (testada no Vitest).
// Também manda os avisos do parceiro (funcionalidade 12) e faz a faxina da galeria: arquivos de documentos excluídos e PDFs exportados vencidos.
//
// Segredos: LEMBRETES_SEGREDO, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...).
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

import { json } from "../_shared/cors.ts";
import { planejar, selecionarParaEnvio, type Enviado, type Lembrete } from "../_shared/dominio/lembretes.ts";
import { planejarParceiro, selecionarParaParceiro } from "../_shared/dominio/parceiro.ts";
import { manutencaoDasDoses, type DoseBase, type MedicamentoAgenda } from "../_shared/dominio/medicamentos.ts";
import { fusoOuPadrao, MS_DIA, normalizarHora } from "../_shared/dominio/tempo.ts";
import { assinarToken } from "../_shared/dominio/token.ts";

const URL_SB = Deno.env.get("SUPABASE_URL")!;
const SEGREDO = Deno.env.get("LEMBRETES_SEGREDO") ?? "";
webpush.setVapidDetails(Deno.env.get("VAPID_SUBJECT") ?? "mailto:contato@ninho.app", Deno.env.get("VAPID_PUBLIC_KEY") ?? "", Deno.env.get("VAPID_PRIVATE_KEY") ?? "");

type Linha = Record<string, unknown>;

function normalizarMed(m: Linha): MedicamentoAgenda & { name: string; dose: string | null; reminders_on: boolean } {
  return {
    ...(m as unknown as MedicamentoAgenda & { name: string; dose: string | null; reminders_on: boolean }),
    times: Array.isArray(m.times) ? (m.times as string[]).map(normalizarHora) : null,
    interval_anchor: typeof m.interval_anchor === "string" ? normalizarHora(m.interval_anchor) : null,
  };
}

Deno.serve(async (req) => {
  if (!SEGREDO || req.headers.get("Authorization") !== `Bearer ${SEGREDO}`) return json({ erro: "não autorizado" }, 401);
  const sb = createClient(URL_SB, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const agora = new Date();
  const resumo = { familias: 0, enviados: 0, doses: 0, erros: 0, arquivosRemovidos: 0 };

  // Galeria (funcionalidade 01): RN-03, excluído some do Storage em até 24 h; RN-09, o PDF exportado vale 24 h.
  try {
    const [excluidos, vencidas] = await Promise.all([sb.rpc("limpar_documentos_excluidos"), sb.rpc("exportacoes_vencidas")]);
    const paginas = (excluidos.data ?? []).map((l: { caminho: string }) => l.caminho);
    const pdfs = (vencidas.data ?? []).map((l: { caminho: string }) => l.caminho);
    for (const [lista, ehPagina] of [[paginas, true], [pdfs, false]] as const) {
      for (let i = 0; i < lista.length; i += 100) {
        const lote = lista.slice(i, i + 100);
        const { error: e } = await sb.storage.from("ninho-privado").remove(lote);
        if (e) continue;
        // Só depois do Storage confirmar: a linha da página sai e o arquivo não fica órfão.
        if (ehPagina) await sb.from("document_pages").delete().in("storage_path", lote);
        resumo.arquivosRemovidos += lote.length;
      }
    }
  } catch (e) {
    console.error("faxina da galeria", e instanceof Error ? e.message : e);
  }

  const { data: gestantes, error } = await sb
    .from("membros_familia")
    .select("familia_id, profile_id, profiles!membros_familia_profile_id_fkey(dpp, modo, tz, prefs, onboarding_concluido_em)")
    .eq("papel", "mae")
    .is("removido_em", null);
  if (error) return json({ erro: error.message }, 500);

  for (const g of gestantes ?? []) {
    const familia = g.familia_id as string;
    const autora = g.profile_id as string;
    const p = (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles) as Linha | null;
    if (!p) continue;
    const tz = fusoOuPadrao(p.tz as string);
    resumo.familias++;
    try {
      const desde = new Date(agora.getTime() - 31 * MS_DIA).toISOString();
      const [meds, doses] = await Promise.all([
        sb.from("medications").select("*").eq("familia_id", familia).is("apagado_em", null),
        sb.from("medication_doses").select("*").eq("familia_id", familia).or(`scheduled_at.gte.${desde},scheduled_at.is.null`),
      ]);
      const medicamentos = (meds.data ?? []).map(normalizarMed);
      const todasDoses = (doses.data ?? []) as unknown as DoseBase[];

      // Job diário do modelo de dados (idempotente: ids determinísticos, estados finais intocados).
      const m = manutencaoDasDoses(medicamentos, todasDoses, agora, tz);
      const carimbo = agora.toISOString();
      if (m.arquivar.length) await sb.from("medications").update({ is_active: false, atualizado_em: carimbo }).in("id", m.arquivar);
      if (m.criar.length) {
        await sb.from("medication_doses").upsert(m.criar.map((d) => ({ ...d, familia_id: familia, criado_por: autora, atualizado_em: carimbo })), { onConflict: "id", ignoreDuplicates: true });
      }
      if (m.apagar.length) await sb.from("medication_doses").update({ apagado_em: carimbo, atualizado_em: carimbo }).in("id", m.apagar);
      if (m.semRegistro.length) await sb.from("medication_doses").update({ status: "missed", atualizado_em: carimbo }).in("id", m.semRegistro).eq("status", "pending");
      resumo.doses += m.criar.length;

      const { data: subs } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth").eq("profile_id", autora);
      if (!subs?.length) continue;

      const [exames, consultas, perguntas, fotos, entradas, estados, enviados, eventos] = await Promise.all([
        sb.from("user_exams").select("*").eq("familia_id", familia).is("apagado_em", null),
        sb.from("appointments").select("*").eq("familia_id", familia).is("apagado_em", null),
        sb.from("appointment_questions").select("*").eq("familia_id", familia).is("apagado_em", null),
        sb.from("belly_photos").select("gest_week").eq("familia_id", familia).is("apagado_em", null),
        sb.from("diary_entries").select("milestone_code").eq("familia_id", familia).eq("criado_por", autora).is("apagado_em", null).not("milestone_code", "is", null),
        sb.from("diary_milestone_states").select("milestone_code, skipped_at, snoozed_until").eq("familia_id", familia).eq("criado_por", autora).is("apagado_em", null),
        sb.from("reminders_sent").select("chave, categoria, ref, enviado_em, essencial").eq("familia_id", familia).gte("enviado_em", new Date(agora.getTime() - 3 * MS_DIA).toISOString()),
        // Funcionalidade 08 RN-06: eventos próprios com lembrete.
        sb.from("calendar_events").select("*").eq("familia_id", familia).is("apagado_em", null).not("remind_offset_minutes", "is", null),
      ]);
      const dosesAtuais = todasDoses.filter((d) => !m.apagar.includes(d.id)).map((d) => (m.semRegistro.includes(d.id) ? { ...d, status: "missed" as const } : d)).concat(m.criar);

      const candidatos = planejar({
        agora,
        tz,
        dpp: p.modo === "gestacao" ? ((p.dpp as string) ?? null) : null,
        criadaEm: (p.onboarding_concluido_em as string) ?? agora.toISOString(),
        prefs: p.prefs as Record<string, unknown>,
        medicamentos,
        doses: dosesAtuais.filter((d) => !d.apagado_em),
        exames: (exames.data ?? []) as never,
        consultas: (consultas.data ?? []) as never,
        perguntas: (perguntas.data ?? []) as never,
        semanasComFoto: (fotos.data ?? []).map((f) => f.gest_week as number),
        marcos: { respondidos: (entradas.data ?? []).map((e) => e.milestone_code as string), estados: (estados.data ?? []) as never },
        eventos: (eventos.data ?? []) as never,
      });
      const saem = selecionarParaEnvio(candidatos, { agora, tz, prefs: p.prefs as Record<string, unknown>, enviados: (enviados.data ?? []) as Enviado[] });

      for (const l of saem) {
        await enviar(l, subs, familia, sb);
        await sb.from("reminders_sent").insert({ familia_id: familia, chave: l.chave, categoria: l.categoria, tipo: l.tipo, ref: l.ref, essencial: l.essencial, enviado_em: agora.toISOString() });
        // exam_reminder_sent / belly_reminder_sent: o log fica em reminders_sent (o GA4 do servidor é a spec de analytics).
        resumo.enviados++;
      }
    } catch (e) {
      resumo.erros++;
      console.error("familia", familia, e instanceof Error ? e.message : e);
    }
  }
  // Funcionalidade 12 RN-08: avisos do parceiro (no fuso dele, com os opt-outs dele, até 3 por semana).
  const dppDaFamilia = new Map((gestantes ?? []).map((g) => {
    const p = (Array.isArray(g.profiles) ? g.profiles[0] : g.profiles) as Linha | null;
    return [g.familia_id as string, p?.modo === "gestacao" ? ((p?.dpp as string) ?? null) : null];
  }));
  const { data: parceiros } = await sb
    .from("membros_familia")
    .select("familia_id, profile_id, permissoes, profiles!membros_familia_profile_id_fkey(tz, prefs)")
    .eq("papel", "parceiro")
    .is("removido_em", null);
  for (const m of parceiros ?? []) {
    const familia = m.familia_id as string;
    const parceiroId = m.profile_id as string;
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Linha | null;
    try {
      const { data: subs } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth").eq("profile_id", parceiroId);
      if (!subs?.length) continue;
      const agenda = (m.permissoes as Record<string, unknown> | null)?.agenda !== false;
      const [consultas, exames, enviados] = await Promise.all([
        agenda ? sb.from("appointments").select("id, starts_at, kind, status, provider_name, location, apagado_em").eq("familia_id", familia).is("apagado_em", null) : Promise.resolve({ data: [] }),
        agenda ? sb.from("user_exams").select("id, catalog_code, custom_name, scheduled_at, scheduled_all_day, atualizado_em").eq("familia_id", familia).eq("status", "scheduled").is("apagado_em", null) : Promise.resolve({ data: [] }),
        sb.from("reminders_sent").select("chave, categoria, ref, enviado_em, essencial").eq("familia_id", familia).like("chave", `partner:${parceiroId}:%`).gte("enviado_em", new Date(agora.getTime() - 8 * MS_DIA).toISOString()),
      ]);
      const tz = fusoOuPadrao(p?.tz as string);
      const candidatos = planejarParceiro({ parceiroId, agora, tz, dpp: dppDaFamilia.get(familia) ?? null, prefs: p?.prefs as Record<string, unknown>, agenda, consultas: (consultas.data ?? []) as never, exames: (exames.data ?? []) as never });
      const saem = selecionarParaParceiro(candidatos, { agora, tz, prefs: p?.prefs as Record<string, unknown>, enviados: (enviados.data ?? []) as Enviado[] });
      for (const l of saem) {
        await enviar(l, subs, familia, sb);
        await sb.from("reminders_sent").insert({ familia_id: familia, chave: l.chave, categoria: l.categoria, tipo: l.tipo, ref: l.ref, essencial: false, enviado_em: agora.toISOString() });
        resumo.enviados++;
      }
    } catch (e) {
      resumo.erros++;
      console.error("parceiro", parceiroId, e instanceof Error ? e.message : e);
    }
  }

  return json(resumo);
});

// deno-lint-ignore no-explicit-any
type Cliente = ReturnType<typeof createClient<any>>;

async function enviar(l: Lembrete, subs: { endpoint: string; p256dh: string; auth: string }[], familia: string, sb: Cliente) {
  const token = l.categoria === "med" ? await assinarToken({ dose: l.ref, familia, exp: Date.now() + 12 * 3_600_000 }, SEGREDO) : undefined;
  const carga = JSON.stringify({
    titulo: l.titulo,
    corpo: l.corpo,
    url: l.url,
    tag: l.chave,
    acoes: l.acoes,
    ref: l.ref,
    categoria: l.categoria,
    token,
    acaoUrl: token ? `${URL_SB}/functions/v1/acao-lembrete` : undefined,
  });
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, carga, { TTL: 60 * 30, urgency: l.essencial ? "high" : "normal" });
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Inscrição que expirou ou foi revogada: sai da lista.
      if (status === 404 || status === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
    }
  }
}
