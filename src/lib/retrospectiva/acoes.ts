import { retrospectivas, type Retrospectiva } from "@/lib/dados/colecoes";
import { idDaRetrospectiva, MAX_FRASE, podeOcultar, type Escolha, type TipoRetro, type TipoSlide } from "@dominio/retrospectiva.ts";

/**
 * Funcionalidade 07: só a configuração é gravada (ocultos e frases), com id determinístico por gestante e tipo
 * (outro aparelho dela não duplica: `unique (familia_id, kind)`).
 */
function atual(semente: string, kind: TipoRetro): Retrospectiva {
  const id = idDaRetrospectiva(semente, kind);
  return retrospectivas.obter(id) ?? { id, kind, hidden_slides: [], chosen_entries: {}, last_exported_at: null, atualizado_em: new Date(0).toISOString(), apagado_em: null };
}

/** RN-05: ocultar ou mostrar; os obrigatórios nunca são ocultados. */
export function alternarSlide(semente: string, kind: TipoRetro, tipo: TipoSlide, autor: string): { oculto: boolean } | null {
  if (!podeOcultar(tipo)) return null;
  const r = atual(semente, kind);
  const oculto = !r.hidden_slides.includes(tipo);
  const hidden_slides = oculto ? [...r.hidden_slides, tipo] : r.hidden_slides.filter((t) => t !== tipo);
  retrospectivas.salvar({ ...r, hidden_slides, criado_por: r.criado_por ?? autor });
  return { oculto };
}

/** RN-04: troca a frase por uma entrada ou por um texto dela; `null` volta ao padrão (o marco). */
export function escolherFrase(semente: string, kind: TipoRetro, tipo: TipoSlide, escolha: Escolha | null, autor: string): void {
  const r = atual(semente, kind);
  const chosen = { ...r.chosen_entries };
  if (escolha && "texto" in escolha) {
    const texto = escolha.texto.replace(/\s+/g, " ").trim().slice(0, MAX_FRASE);
    if (texto) chosen[tipo] = { texto };
    else delete chosen[tipo];
  } else if (escolha) chosen[tipo] = { entrada: escolha.entrada };
  else delete chosen[tipo];
  // Escolher uma frase para um slide oculto o traz de volta.
  const hidden_slides = escolha ? r.hidden_slides.filter((t) => t !== tipo) : r.hidden_slides;
  retrospectivas.salvar({ ...r, chosen_entries: chosen, hidden_slides, criado_por: r.criado_por ?? autor });
}

export function marcarExportada(semente: string, kind: TipoRetro, autor: string): void {
  const r = atual(semente, kind);
  retrospectivas.salvar({ ...r, last_exported_at: new Date().toISOString(), criado_por: r.criado_por ?? autor });
}
