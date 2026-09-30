import { track } from "@/lib/analytics";
import { encerrarPeito as fecharPeito, trocarLado as trocarLadoDados } from "@/lib/bebe/registros";
import { novoId } from "@/lib/dados/colecao";
import { registrosBebe, type DadosMamada, type DadosRegistro, type RegistroBebe, type TipoRegistroBebe } from "@/lib/dados/colecoes";
import { meuId } from "@/lib/familia/useFamilia";

/** Cria um registro (BEB-01). `fim` null = em andamento. */
export function criarRegistro(
  bebeId: string,
  tipo: TipoRegistroBebe,
  inicio: Date,
  fim: Date | null,
  dados: DadosRegistro,
  origem: RegistroBebe["origem"] = "manual",
): RegistroBebe {
  const r = registrosBebe.salvar({
    id: novoId(),
    bebe_id: bebeId,
    tipo,
    inicio: inicio.toISOString(),
    fim: fim?.toISOString() ?? null,
    dados,
    origem,
    criado_por: meuId(),
  });
  if (fim) track("registro_criado", { tipo, origem, atraso_min: Math.max(0, Math.round((Date.now() - fim.getTime()) / 60_000)) });
  else track("timer_iniciado", { tipo, lado: (dados as DadosMamada).lado ?? undefined });
  return r;
}

export function atualizarRegistro(r: RegistroBebe, mudancas: Partial<RegistroBebe>, campo: string): RegistroBebe {
  track("registro_editado", { tipo: r.tipo, campo });
  return registrosBebe.salvar({ ...r, ...mudancas });
}

/** Encerra um sono ou mamada em andamento. */
export function encerrar(r: RegistroBebe, fim: Date = new Date()): RegistroBebe {
  const dados = r.tipo === "mamada" && (r.dados as DadosMamada).tipo === "peito" ? fecharPeito(r.dados as DadosMamada, fim) : r.dados;
  track("timer_encerrado", { tipo: r.tipo, minutos: Math.round((fim.getTime() - new Date(r.inicio).getTime()) / 60_000) });
  return registrosBebe.salvar({ ...r, fim: fim.toISOString(), dados });
}

export function iniciarPeito(bebeId: string, lado: "E" | "D", inicio: Date = new Date(), origem: RegistroBebe["origem"] = "timer"): RegistroBebe {
  const dados: DadosMamada = { tipo: "peito", lado, segundos_E: 0, segundos_D: 0, lado_desde: inicio.toISOString() };
  return criarRegistro(bebeId, "mamada", inicio, null, dados, origem);
}

export function trocarLadoPeito(r: RegistroBebe, lado: "E" | "D"): RegistroBebe {
  return registrosBebe.salvar({ ...r, dados: trocarLadoDados(r.dados as DadosMamada, lado) });
}

/** BEB-09: soft delete; quem chama mostra o toast com "desfazer". */
export function apagarRegistro(r: RegistroBebe): () => void {
  registrosBebe.apagar(r.id);
  track("registro_apagado", { tipo: r.tipo, desfeito: false });
  return () => {
    registrosBebe.salvar({ ...r, apagado_em: null });
    track("registro_apagado", { tipo: r.tipo, desfeito: true });
  };
}
