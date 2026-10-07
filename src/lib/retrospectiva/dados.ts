import type { Appointment, Bebe, BellyPhoto, DiaryEntry, DocumentPage, MedicalDocument, Retrospectiva } from "@/lib/dados/colecoes";
import { previaDisponivel, type ConfigRetro, type DadosRetro, type Nascimento, type TipoRetro } from "@dominio/retrospectiva.ts";
import { dataNoFuso, horaNoFuso, type DataISO } from "@dominio/tempo.ts";

/**
 * Funcionalidade 07: junta o que está no aparelho no formato do domínio. Puro (testável); o hook só lê as coleções.
 * Os slides nunca são gravados (só a configuração): sempre saem dos dados vivos.
 */
export interface Fontes {
  kind: TipoRetro;
  autora: string;
  dpp: DataISO | null | undefined;
  hoje: DataISO;
  tz: string;
  nomeDoBebe: string | null | undefined;
  bebes: Bebe[];
  entradas: DiaryEntry[];
  fotos: BellyPhoto[];
  documentos: MedicalDocument[];
  paginas: DocumentPage[];
  consultas: Appointment[];
}

const vivo = <T extends { apagado_em?: string | null }>(x: T) => !x.apagado_em;

/** O nascimento (RN-02) a partir dos bebês: gêmeos viram "Ana e Bia" e, sem um peso só, ficam sem peso e comprimento. */
export function nascimentoDosBebes(bebes: Bebe[], tz: string): Nascimento | null {
  const lista = bebes.filter(vivo).sort((a, b) => a.ordem - b.ordem);
  const primeiro = lista[0];
  if (!primeiro) return null;
  const instante = new Date(primeiro.nascido_em);
  const nomes = lista.map((b) => b.nome.trim()).filter((n) => n && n !== "Bebê");
  const nome = nomes.length ? nomes.slice(0, -1).join(", ") + (nomes.length > 1 ? " e " : "") + nomes.at(-1) : null;
  const um = lista.length === 1;
  return {
    nome,
    data: dataNoFuso(instante, tz),
    hora: horaNoFuso(instante, tz),
    peso_g: um ? (primeiro.peso_g ?? null) : null,
    comprimento_cm: um ? (primeiro.comprimento_cm ?? null) : null,
  };
}

/** RN-01: a prévia a partir de 36s0d (e para sempre depois); a final, só com o nascimento registrado. */
export function disponiveis(dpp: DataISO | null | undefined, hoje: DataISO, nascido: boolean): TipoRetro[] {
  const saida: TipoRetro[] = [];
  if (nascido) saida.push("final");
  if (previaDisponivel(dpp, hoje)) saida.push("preview");
  return saida;
}

export function montarDados(f: Fontes): DadosRetro {
  const nascimento = nascimentoDosBebes(f.bebes, f.tz);
  const entradas = f.entradas.filter(vivo);
  const documentos = f.documentos.filter(vivo);
  const fotos = f.fotos.filter(vivo);
  // A primeira página em imagem de cada documento é o "retrato" do ultrassom.
  const capa = new Map<string, DocumentPage>();
  for (const p of f.paginas.filter((x) => vivo(x) && x.mime.startsWith("image/"))) {
    const atual = capa.get(p.document_id);
    if (!atual || p.position < atual.position) capa.set(p.document_id, p);
  }
  // A prévia para no nascimento: depois dele, "até hoje" não é mais a gravidez.
  const hoje = f.kind === "preview" && nascimento && nascimento.data < f.hoje ? nascimento.data : f.hoje;
  return {
    kind: f.kind,
    autora: f.autora,
    dpp: f.dpp ?? hoje,
    hoje,
    nomeDoBebe: f.nomeDoBebe?.trim() || null,
    nascimento: f.kind === "final" ? nascimento : null,
    entradas: entradas.map((e) => ({ id: e.id, body: e.body, entry_date: e.entry_date, milestone_code: e.milestone_code, criado_por: e.criado_por ?? null })),
    fotos: fotos.map((p) => ({ id: p.id, gest_week: p.gest_week, storage_path: p.storage_path })),
    ultrassons: documentos.map((d) => ({ id: d.id, kind: d.kind, exam_date: d.exam_date, is_favorite: d.is_favorite, storage_path: capa.get(d.id)?.storage_path ?? null })),
    numeros: {
      consultas: f.consultas.filter((c) => vivo(c) && c.status === "done").length,
      documentos: documentos.length,
      fotos: fotos.length,
      entradas: entradas.filter((e) => e.criado_por === f.autora).length,
    },
  };
}

export function configDe(r: Retrospectiva | undefined): ConfigRetro {
  return { hidden_slides: r?.hidden_slides ?? [], chosen_entries: (r?.chosen_entries ?? {}) as ConfigRetro["chosen_entries"] };
}
