/**
 * Funcionalidade 08 · Calendário: itens derivados das outras funcionalidades (nada é copiado,
 * então não há sincronização), eventos próprios, marcadores de semana, lembretes e iCal.
 * Puro: o app e a Edge Function `calendario-ics` usam o mesmo.
 */
import type { ConsultaBase } from "./consultas.ts";
import { nomeDoExame } from "./exames.ts";
import type { Lembrete } from "./lembretes.ts";
import type { DoseBase } from "./medicamentos.ts";
import { dataNoFuso, diasEntreISO, dumDaDpp, horaNoFuso, idadeGestacional, inicioDaSemana, instanteLocal, MS_HORA, somarDiasISO, type DataISO } from "./tempo.ts";

export const CATEGORIAS_EVENTO = ["exam", "appointment", "course", "purchase", "other"] as const;
export type CategoriaEvento = (typeof CATEGORIAS_EVENTO)[number];
/** RN-06: nenhum, na hora, 1 hora antes, 1 dia antes às 09:00. */
export const LEMBRETES_EVENTO = [null, 0, 60, 1440] as const;
export type LembreteEvento = (typeof LEMBRETES_EVENTO)[number];

export interface EventoCalendario {
  id: string;
  title: string;
  category: CategoriaEvento;
  starts_at: string | null;
  all_day: boolean;
  all_day_date: DataISO | null;
  notes: string | null;
  remind_offset_minutes: number | null;
  visible_to_partner: boolean;
  apagado_em?: string | null;
}

export type TipoItem = "appointment" | "exam" | "custom" | "med_day" | "belly_photo" | "edd";
/** Cor por tipo de registro (tokens do design system). */
export type CorItem = "primaria" | "acento" | "sono" | "banho" | "fralda" | "sucesso";
export const COR_DO_TIPO: Record<TipoItem, CorItem> = { appointment: "primaria", exam: "acento", custom: "sono", med_day: "banho", belly_photo: "fralda", edd: "sucesso" };

export interface ItemCalendario {
  tipo: TipoItem;
  id: string;
  titulo: string;
  /** Dia local (no fuso dela, RN-10). */
  data: DataISO;
  /** Instante, para os que têm hora. */
  inicio: string | null;
  diaInteiro: boolean;
  cor: CorItem;
  /** RN-03: derivados abrem a tela de origem; só `custom` é editável aqui. */
  link: string;
  local?: string | null;
  /** RN-05: foto da semana já tirada. RN-04: adesão do dia passado. */
  feito?: boolean;
  detalhe?: string | null;
}

export interface FonteCalendario {
  consultas: ConsultaBase[];
  exames: { id: string; catalog_code: string | null; custom_name: string | null; status: string; scheduled_at: string | null; scheduled_all_day?: boolean; apagado_em?: string | null }[];
  eventos: EventoCalendario[];
  doses: DoseBase[];
  semanasComFoto: number[];
  dpp: DataISO | null;
}

export interface OpcoesCalendario {
  tz: string;
  hoje: DataISO;
  /** RN-11: o parceiro não vê medicamentos nem fotos; eventos só os visíveis; tudo com `agenda`. */
  papel: "mae" | "parceiro" | "outro";
  agenda: boolean;
}

/** Primeira e última semana da grade da barriga (spec 05). */
const SEMANAS_FOTO: [number, number] = [4, 42];

export function itensDoCalendario(f: FonteCalendario, o: OpcoesCalendario): ItemCalendario[] {
  const mae = o.papel === "mae";
  const veAgenda = mae || (o.papel === "parceiro" && o.agenda);
  const itens: ItemCalendario[] = [];

  if (veAgenda) {
    for (const c of f.consultas) {
      if (c.apagado_em || c.status !== "scheduled") continue;
      itens.push({ tipo: "appointment", id: c.id, titulo: c.provider_name?.trim() || "Consulta", data: dataNoFuso(new Date(c.starts_at), o.tz), inicio: c.starts_at, diaInteiro: false, cor: COR_DO_TIPO.appointment, link: `/consultas/${c.id}`, local: c.location ?? null });
    }
    for (const e of f.exames) {
      if (e.apagado_em || e.status !== "scheduled" || !e.scheduled_at) continue;
      const diaInteiro = Boolean(e.scheduled_all_day);
      itens.push({ tipo: "exam", id: e.id, titulo: nomeDoExame(e), data: dataNoFuso(new Date(e.scheduled_at), o.tz), inicio: diaInteiro ? null : e.scheduled_at, diaInteiro, cor: COR_DO_TIPO.exam, link: mae ? `/exames/${e.id}` : "/calendario" });
    }
    for (const ev of f.eventos) {
      if (ev.apagado_em || (!mae && !ev.visible_to_partner)) continue;
      const data = ev.all_day ? ev.all_day_date : ev.starts_at ? dataNoFuso(new Date(ev.starts_at), o.tz) : null;
      if (!data) continue;
      itens.push({ tipo: "custom", id: ev.id, titulo: ev.title, data, inicio: ev.all_day ? null : ev.starts_at, diaInteiro: ev.all_day, cor: COR_DO_TIPO.custom, link: `/calendario/evento?id=${ev.id}`, detalhe: ev.notes });
    }
  }

  if (mae) {
    // RN-04: um item por dia, "Medicamentos (n)"; nos dias passados, a adesão do dia.
    const porDia = new Map<DataISO, DoseBase[]>();
    for (const d of f.doses) {
      if (d.apagado_em || !d.scheduled_at) continue;
      const dia = dataNoFuso(new Date(d.scheduled_at), o.tz);
      porDia.set(dia, [...(porDia.get(dia) ?? []), d]);
    }
    for (const [dia, doses] of porDia) {
      const tomadas = doses.filter((d) => d.status === "taken").length;
      const passado = dia < o.hoje;
      itens.push({ tipo: "med_day", id: `med-${dia}`, titulo: `Medicamentos (${doses.length})`, data: dia, inicio: null, diaInteiro: true, cor: COR_DO_TIPO.med_day, link: "/medicamentos", feito: passado ? tomadas === doses.length : undefined, detalhe: passado ? `${tomadas} de ${doses.length} tomadas` : null });
    }
    // RN-05: marcador no dia da virada de semana; com check se a foto existe.
    if (f.dpp) {
      const com = new Set(f.semanasComFoto);
      for (let s = SEMANAS_FOTO[0]; s <= SEMANAS_FOTO[1]; s++) {
        itens.push({ tipo: "belly_photo", id: `foto-${s}`, titulo: `Foto da semana ${s}`, data: inicioDaSemana(f.dpp, s), inicio: null, diaInteiro: true, cor: COR_DO_TIPO.belly_photo, link: "/barriga", feito: com.has(s) });
      }
    }
  }

  // RN-07: a DPP, para todos que acompanham, não editável aqui.
  if (f.dpp) itens.push({ tipo: "edd", id: "dpp", titulo: "Data provável do parto", data: f.dpp, inicio: null, diaInteiro: true, cor: COR_DO_TIPO.edd, link: "/hoje" });
  return itens;
}

/** Itens de um dia: os de dia inteiro primeiro, depois por hora. */
export function itensDoDia(itens: ItemCalendario[], data: DataISO): ItemCalendario[] {
  return itens
    .filter((i) => i.data === data)
    .sort((a, b) => Number(b.diaInteiro) - Number(a.diaInteiro) || (a.inicio ?? "").localeCompare(b.inicio ?? "") || a.titulo.localeCompare(b.titulo));
}

/** RN-01: até 3 pontos por dia e "+n". */
export function pontosDoDia(itens: ItemCalendario[]): { cores: CorItem[]; mais: number } {
  return { cores: itens.slice(0, 3).map((i) => i.cor), mais: Math.max(0, itens.length - 3) };
}

/** RN-02: no dia em que a semana muda, o marcador "22s" (semanas 1 a 42). */
export function viradaDeSemana(dpp: DataISO | null | undefined, data: DataISO): number | null {
  if (!dpp) return null;
  const dias = diasEntreISO(dumDaDpp(dpp), data);
  if (dias <= 0 || dias % 7 !== 0) return null;
  const s = dias / 7;
  return s <= 42 ? s : null;
}

/** RN-02: cabeçalho de dia da agenda, "22s3d" (nada antes da DUM ou depois de 42s6d). */
export function rotuloGestacional(dpp: DataISO | null | undefined, data: DataISO): string | null {
  if (!dpp) return null;
  const g = idadeGestacional(dpp, data);
  if (g.dias < 0 || g.semana > 42) return null;
  return `${g.semana}s${g.dia}d`;
}

/** Grade do mês: semanas de domingo a sábado, com os dias de fora como null. */
export function gradeDoMes(ano: number, mes: number): (DataISO | null)[][] {
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01` as DataISO;
  const diaSemana = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas: (DataISO | null)[] = [...Array<null>(diaSemana).fill(null), ...Array.from({ length: dias }, (_, i) => somarDiasISO(primeiro, i))];
  while (celulas.length % 7) celulas.push(null);
  const semanas: (DataISO | null)[][] = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return semanas;
}

export function mesSeguinte(ano: number, mes: number, passo: number): { ano: number; mes: number } {
  const t = ano * 12 + (mes - 1) + passo;
  return { ano: Math.floor(t / 12), mes: (t % 12) + 1 };
}

// ---------------------------------------------------------------------------
// Evento próprio (RN-06)
// ---------------------------------------------------------------------------
export interface DadosEvento {
  title: string;
  category: CategoriaEvento;
  all_day: boolean;
  data: DataISO;
  hora: string | null;
  notes: string;
  remind_offset_minutes: LembreteEvento;
  visible_to_partner: boolean;
}

export type ErroEvento = "sem_titulo" | "titulo_longo" | "sem_data" | "sem_hora" | "notas_longas";

export function validarEvento(d: DadosEvento): ErroEvento[] {
  const erros: ErroEvento[] = [];
  const t = d.title.trim();
  if (!t) erros.push("sem_titulo");
  if (t.length > 80) erros.push("titulo_longo");
  if (!d.data) erros.push("sem_data");
  if (!d.all_day && !d.hora) erros.push("sem_hora");
  if (d.notes.length > 500) erros.push("notas_longas");
  return erros;
}

/** RN-06 + RN-10: dia inteiro guarda a data local; com hora, o instante no fuso dela. */
export function eventoDosDados(d: DadosEvento, tz: string): Pick<EventoCalendario, "title" | "category" | "starts_at" | "all_day" | "all_day_date" | "notes" | "remind_offset_minutes" | "visible_to_partner"> {
  return {
    title: d.title.trim(),
    category: d.category,
    all_day: d.all_day,
    all_day_date: d.all_day ? d.data : null,
    starts_at: d.all_day ? null : instanteLocal(d.data, d.hora!, tz).toISOString(),
    notes: d.notes.trim() || null,
    remind_offset_minutes: d.remind_offset_minutes,
    visible_to_partner: d.visible_to_partner,
  };
}

/** Quando o lembrete do evento sai. Dia inteiro: "na hora" = 09:00 do dia, "1 hora antes" = 08:00. */
export function horaDoLembrete(ev: EventoCalendario, tz: string): Date | null {
  if (ev.remind_offset_minutes === null || ev.remind_offset_minutes === undefined) return null;
  const dia = ev.all_day ? ev.all_day_date : ev.starts_at ? dataNoFuso(new Date(ev.starts_at), tz) : null;
  if (!dia) return null;
  if (ev.remind_offset_minutes === 1440) return instanteLocal(somarDiasISO(dia, -1), "09:00", tz);
  const base = ev.all_day ? instanteLocal(dia, "09:00", tz) : new Date(ev.starts_at!);
  return new Date(base.getTime() - ev.remind_offset_minutes * 60_000);
}

export function lembretesDeEventos(eventos: EventoCalendario[], tz: string): Lembrete[] {
  const saida: Lembrete[] = [];
  for (const ev of eventos) {
    if (ev.apagado_em) continue;
    const em = horaDoLembrete(ev, tz);
    if (!em) continue;
    const quando = ev.all_day ? null : horaNoFuso(new Date(ev.starts_at!), tz);
    const corpo = ev.remind_offset_minutes === 1440 ? (quando ? `Amanhã às ${quando}` : "Amanhã") : ev.remind_offset_minutes === 60 ? (quando ? `Daqui a 1 hora, às ${quando}` : "Hoje") : quando ? `Agora, às ${quando}` : "Hoje";
    saida.push({
      chave: `calendar:${ev.id}:${ev.remind_offset_minutes}:${ev.starts_at ?? ev.all_day_date}`,
      categoria: "calendar",
      tipo: "calendar_event",
      ref: ev.id,
      em,
      titulo: ev.title,
      corpo,
      url: `/calendario/evento?id=${ev.id}&origem=lembrete&categoria=calendar`,
      acoes: [],
      essencial: false,
      prioridade: 65,
    });
  }
  return saida;
}

// ---------------------------------------------------------------------------
// iCal (RN-08/09)
// ---------------------------------------------------------------------------
export interface ItemIcs {
  item_type: "appointment" | "exam" | "custom" | "edd";
  item_id: string;
  title: string;
  location?: string | null;
  starts_at: string | null;
  all_day: boolean;
  all_day_date: DataISO | null;
}

const DURACAO_PADRAO_MS = MS_HORA;

function escapar(t: string): string {
  return t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545: linhas de no máximo 75 octetos, continuação com espaço. */
export function dobrar(linha: string): string {
  const bytes = new TextEncoder();
  const partes: string[] = [];
  let atual = "";
  for (const ch of linha) {
    if (bytes.encode(atual + ch).length > (partes.length ? 74 : 75)) {
      partes.push(atual);
      atual = ch;
    } else atual += ch;
  }
  partes.push(atual);
  return partes.join("\r\n ");
}

const utc = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const dataIcs = (d: DataISO) => d.replace(/-/g, "");

/** RN-08: UID estável por item. */
export function uidDoItem(i: Pick<ItemIcs, "item_type" | "item_id">): string {
  return `${i.item_type}-${i.item_id}@ninho`;
}

function vevento(i: ItemIcs, carimbo: Date): string[] {
  const linhas = ["BEGIN:VEVENT", `UID:${uidDoItem(i)}`, `DTSTAMP:${utc(carimbo)}`];
  if (i.all_day && i.all_day_date) {
    linhas.push(`DTSTART;VALUE=DATE:${dataIcs(i.all_day_date)}`, `DTEND;VALUE=DATE:${dataIcs(somarDiasISO(i.all_day_date, 1))}`);
  } else if (i.starts_at) {
    const ini = new Date(i.starts_at);
    linhas.push(`DTSTART:${utc(ini)}`, `DTEND:${utc(new Date(ini.getTime() + DURACAO_PADRAO_MS))}`);
  } else return [];
  linhas.push(`SUMMARY:${escapar(i.title)}`);
  // Decidido na spec: título e local; nunca notas.
  if (i.location) linhas.push(`LOCATION:${escapar(i.location)}`);
  linhas.push("END:VEVENT");
  return linhas;
}

export function gerarIcs(itens: ItemIcs[], carimbo: Date, nome = "Ninho · gravidez"): string {
  const linhas = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Ninho//Calendario//PT-BR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${escapar(nome)}`, "REFRESH-INTERVAL;VALUE=DURATION:PT15M", "X-PUBLISHED-TTL:PT15M"];
  for (const i of itens) linhas.push(...vevento(i, carimbo));
  linhas.push("END:VCALENDAR");
  return linhas.map(dobrar).join("\r\n") + "\r\n";
}

/** RN-08: o feed só leva consultas, exames marcados, eventos próprios e DPP. */
export function itensDoFeed(itens: ItemCalendario[]): ItemIcs[] {
  return itens.flatMap((i) =>
    i.tipo === "appointment" || i.tipo === "exam" || i.tipo === "custom" || i.tipo === "edd"
      ? [{ item_type: i.tipo, item_id: i.tipo === "edd" ? "dpp" : i.id, title: i.titulo, location: i.local ?? null, starts_at: i.inicio, all_day: i.diaInteiro, all_day_date: i.diaInteiro ? i.data : null }]
      : [],
  );
}
