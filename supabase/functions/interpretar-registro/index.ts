// Edge Function `interpretar-registro` (spec 08, VOZ-03/04/06/09/10).
// Recebe a transcrição e o contexto mínimo (modo, hora local, bebês, últimos 3 registros),
// pede ao modelo um JSON estrito e guarda a interpretação em voz_interpretacoes.
// Deploy: `supabase functions deploy interpretar-registro`; segredo: `supabase secrets set ANTHROPIC_API_KEY=...`.
import Anthropic from "npm:@anthropic-ai/sdk@0.130.0";
import { createClient } from "npm:@supabase/supabase-js@2";

import { corsHeaders, json } from "../_shared/cors.ts";

// VOZ-09: modelo pequeno e barato, prompt fixo com cache, temperatura 0.
const MODELO = Deno.env.get("MODELO_VOZ") ?? "claude-haiku-4-5";

interface Contexto {
  modo: "gestacao" | "bebe";
  agoraLocal: string; // ISO com fuso do aparelho, ex. 2026-10-01T03:12:00-03:00
  bebes?: { id: string; nome: string }[];
  bebeAtivoId?: string;
  ultimosRegistros?: { tipo: string; inicio: string; fim: string | null; resumo: string }[];
}

const SISTEMA = `Você interpreta frases curtas em português do Brasil ditas por uma gestante ou por quem cuida de um bebê, às vezes de madrugada, e devolve registros estruturados.

Regras:
- Devolva SEMPRE chamando a ferramenta "registrar", nunca texto solto.
- Horários relativos ("há 20 minutos", "meia hora atrás", "às 3 e meia") viram instantes absolutos no fuso do aparelho, usando "agoraLocal" como referência. Sem menção de hora, fim = agora e inicio = agora − duração. Sem duração, registro pontual (fim = inicio).
- "Dormiu" sem duração inicia um sono em andamento (fim null), a menos que já exista um em andamento; "acordou" encerra o sono em andamento.
- Uma frase pode gerar até 3 registros.
- Em modo gestação os tipos são sintoma, chute, contracao, consulta. Em modo bebê: sono, mamada, fralda, banho, outro.
- Se o nome de um bebê aparecer na frase, use o id dele em bebe_id.
- Se a frase não descreve nenhum registro ("comprei pão"), devolva registros vazio e confianca baixa.
- Nunca invente horários no futuro.`;

const FERRAMENTA: Anthropic.Tool = {
  name: "registrar",
  description: "Devolve os registros entendidos a partir da frase.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["registros", "confianca", "resumo"],
    properties: {
      confianca: { type: "number", description: "0 a 1" },
      resumo: { type: "string", description: "Uma linha para confirmar, ex. 'Mamada no direito, 12 min'" },
      registros: {
        type: "array",
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["tipo", "inicio", "fim", "dados", "bebe_id"],
          properties: {
            tipo: { type: "string", enum: ["sono", "mamada", "fralda", "banho", "outro", "sintoma", "chute", "contracao", "consulta"] },
            inicio: { type: "string", description: "ISO 8601 com fuso" },
            fim: { type: ["string", "null"], description: "ISO 8601 com fuso, ou null para em andamento" },
            bebe_id: { type: ["string", "null"] },
            dados: {
              type: "object",
              additionalProperties: false,
              required: ["lado", "ml", "tipo_mamada", "conteudo", "texto", "slug", "intensidade", "quantidade"],
              properties: {
                lado: { type: ["string", "null"], enum: ["E", "D", "ambos", null] },
                ml: { type: ["integer", "null"] },
                tipo_mamada: { type: ["string", "null"], enum: ["peito", "mamadeira", "formula", "bomba", null] },
                conteudo: { type: ["string", "null"], enum: ["xixi", "coco", "ambos", "seca", null] },
                texto: { type: ["string", "null"] },
                slug: { type: ["string", "null"], description: "slug do sintoma no catálogo" },
                intensidade: { type: ["integer", "null"], enum: [1, 2, 3, null] },
                quantidade: { type: ["integer", "null"] },
              },
            },
          },
        },
      },
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const t0 = Date.now();

  // ARQ-06: só com JWT válido do usuário.
  const auth = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: usuario } = await sb.auth.getUser();
  if (!usuario.user) return json({ erro: "sem sessão" }, 401);

  let corpo: { transcricao?: string; contexto?: Contexto };
  try {
    corpo = await req.json();
  } catch {
    return json({ erro: "corpo inválido" }, 400);
  }
  const transcricao = (corpo.transcricao ?? "").trim().slice(0, 500);
  const contexto = corpo.contexto;
  if (!transcricao || !contexto?.modo || !contexto.agoraLocal) return json({ erro: "faltam transcricao e contexto" }, 400);

  const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") });
  let resposta: Anthropic.Message;
  try {
    resposta = await anthropic.messages.create({
      model: MODELO,
      max_tokens: 1024,
      temperature: 0,
      system: [{ type: "text", text: SISTEMA, cache_control: { type: "ephemeral" } }],
      tools: [FERRAMENTA],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: `Contexto: ${JSON.stringify(contexto)}\nFrase: "${transcricao}"\nChame a ferramenta "registrar".`,
        },
      ],
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ erro: "limite", tentar_local: true }, 429);
    if (e instanceof Anthropic.APIError) return json({ erro: e.message, tentar_local: true }, 502);
    throw e;
  }

  const bloco = resposta.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!bloco) return json({ registros: [], confianca: 0, resumo: "", motivo: "sem_ferramenta" });
  const saida = bloco.input as { registros: unknown[]; confianca: number; resumo: string };

  // VOZ-06: futuro invalida.
  const agora = new Date(contexto.agoraLocal).getTime();
  const futuro = (saida.registros as { inicio: string; fim: string | null }[]).some((r) => new Date(r.fim ?? r.inicio).getTime() > agora + 60_000);
  if (futuro) saida.confianca = Math.min(saida.confianca, 0.3);

  // VOZ-10: guarda para medir precisão (a transcrição é apagada por job em 30 dias).
  const { data: gravada } = await sb
    .from("voz_interpretacoes")
    .insert({ transcricao, resposta: saida, confianca: saida.confianca, ms_total: Date.now() - t0 })
    .select("id")
    .single();

  return json({ ...saida, interpretacao_id: gravada?.id ?? null, ms: Date.now() - t0 });
});
