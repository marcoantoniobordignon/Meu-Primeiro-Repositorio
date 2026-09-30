import { track } from "@/lib/analytics";
import { novoId } from "@/lib/dados/colecao";
import { sintomas, type Sintoma } from "@/lib/dados/colecoes";
import type { DataISO } from "@/lib/dates";
import type { Intensidade } from "@/lib/sintomas/regras";

/** Registro vivo de um sintoma num dia (UNIQUE familia, data, slug). */
export function registroDe(slug: string, data: DataISO): Sintoma | undefined {
  return sintomas.listar().find((s) => s.slug === slug && s.data === data);
}

/** SIN-02/03: cria ou atualiza a intensidade; null remove (soft delete). Otimista. */
export function definirIntensidade(
  slug: string,
  data: DataISO,
  intensidade: Intensidade | null,
  origem: Sintoma["origem"],
): Sintoma | null {
  const existente = registroDe(slug, data);
  if (intensidade === null) {
    if (existente) {
      sintomas.apagar(existente.id);
      track("sintoma_removido", { slug });
    }
    return null;
  }
  const salvo = sintomas.salvar({
    id: existente?.id ?? novoId(),
    data,
    slug,
    intensidade,
    nota: existente?.nota ?? null,
    origem: existente?.origem ?? origem,
  });
  track("sintoma_registrado", { slug, intensidade, origem });
  return salvo;
}

/** Guarda a nota do dia em cada registro daquele dia. */
export function definirNotaDoDia(data: DataISO, nota: string) {
  for (const s of sintomas.listar().filter((s) => s.data === data)) {
    if ((s.nota ?? "") !== nota) sintomas.salvar({ ...s, nota: nota || null });
  }
}

export function notaDoDia(itens: Sintoma[]): string {
  return itens.find((s) => s.nota)?.nota ?? "";
}
