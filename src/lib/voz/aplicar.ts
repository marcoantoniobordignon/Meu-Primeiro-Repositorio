import { apagarRegistro, criarRegistro, encerrar, iniciarPeito } from "@/components/features/bebe/acoes";
import { definirIntensidade } from "@/components/features/sintomas/acoes";
import { mamadaEmAndamento, sonoEmAndamento } from "@/lib/bebe/registros";
import { sessaoAtiva } from "@/lib/chutes-contracoes";
import { novoId } from "@/lib/dados/colecao";
import { contracoes, registrosBebe, sessoesChutes, type DadosMamada, type RegistroBebe } from "@/lib/dados/colecoes";
import { paraISO } from "@/lib/dates";

import type { RegistroVoz } from "./parser";

export interface Aplicado {
  /** Registros do bebê criados (para "Corrigir" e "desfazer"). */
  registros: RegistroBebe[];
  desfazer: () => void;
}

/** Grava o que o parser entendeu, roteando por tipo (spec 08, modelo de dados). */
export function aplicarRegistros(lista: RegistroVoz[], bebeAtivoId: string | undefined): Aplicado {
  const criados: RegistroBebe[] = [];
  const desfazeres: (() => void)[] = [];

  for (const r of lista) {
    switch (r.tipo) {
      case "sono": {
        const bebeId = r.bebe_id ?? bebeAtivoId;
        if (!bebeId) break;
        const reg = criarRegistro(bebeId, "sono", new Date(r.inicio), r.fim ? new Date(r.fim) : null, {}, "voz");
        criados.push(reg);
        desfazeres.push(apagarRegistro.bind(null, reg));
        break;
      }
      case "acordou": {
        const bebeId = r.bebe_id ?? bebeAtivoId;
        if (!bebeId) break;
        const emAndamento = sonoEmAndamento(registrosBebe.listar(), bebeId);
        if (emAndamento) {
          const antes = { ...emAndamento };
          const reg = encerrar(emAndamento, new Date(r.fim));
          criados.push(reg);
          desfazeres.push(() => registrosBebe.salvar(antes));
        }
        break;
      }
      case "mamada": {
        const bebeId = r.bebe_id ?? bebeAtivoId;
        if (!bebeId) break;
        const dur = new Date(r.fim).getTime() - new Date(r.inicio).getTime();
        if (r.dados.tipo === "peito" && dur === 0 && !mamadaEmAndamento(registrosBebe.listar(), bebeId)) {
          // "mamou no direito" sem duração: começa o timer.
          const reg = iniciarPeito(bebeId, r.dados.lado === "E" ? "E" : "D", new Date(r.inicio), "voz");
          criados.push(reg);
          desfazeres.push(apagarRegistro.bind(null, reg));
          break;
        }
        const dados: DadosMamada = { tipo: r.dados.tipo, lado: r.dados.lado, ml: r.dados.ml };
        if (r.dados.tipo === "peito") {
          const seg = Math.round(dur / 1000);
          dados.segundos_E = r.dados.lado === "E" || r.dados.lado === "ambos" ? (r.dados.lado === "ambos" ? Math.round(seg / 2) : seg) : 0;
          dados.segundos_D = r.dados.lado === "D" || r.dados.lado === "ambos" ? (r.dados.lado === "ambos" ? Math.round(seg / 2) : seg) : 0;
        }
        const reg = criarRegistro(bebeId, "mamada", new Date(r.inicio), new Date(r.fim), dados, "voz");
        criados.push(reg);
        desfazeres.push(apagarRegistro.bind(null, reg));
        break;
      }
      case "fralda": {
        const bebeId = r.bebe_id ?? bebeAtivoId;
        if (!bebeId) break;
        const reg = criarRegistro(bebeId, "fralda", new Date(r.inicio), new Date(r.inicio), r.dados, "voz");
        criados.push(reg);
        desfazeres.push(apagarRegistro.bind(null, reg));
        break;
      }
      case "banho": {
        const bebeId = r.bebe_id ?? bebeAtivoId;
        if (!bebeId) break;
        const reg = criarRegistro(bebeId, "banho", new Date(r.inicio), new Date(r.inicio), {}, "voz");
        criados.push(reg);
        desfazeres.push(apagarRegistro.bind(null, reg));
        break;
      }
      case "sintoma": {
        const hoje = paraISO(new Date());
        definirIntensidade(r.slug, hoje, r.intensidade, "voz");
        desfazeres.push(() => definirIntensidade(r.slug, hoje, null, "voz"));
        break;
      }
      case "chute": {
        const ativa = sessaoAtiva(sessoesChutes.listar());
        if (ativa) {
          sessoesChutes.salvar({ ...ativa, total: ativa.total + r.quantidade });
          desfazeres.push(() => sessoesChutes.salvar(ativa));
        } else {
          const nova = sessoesChutes.salvar({ id: novoId(), inicio: new Date().toISOString(), total: r.quantidade });
          desfazeres.push(() => sessoesChutes.apagar(nova.id));
        }
        break;
      }
      case "contracao": {
        const nova = contracoes.salvar({ id: novoId(), inicio: r.inicio, fim: r.fim });
        desfazeres.push(() => contracoes.apagar(nova.id));
        break;
      }
    }
  }

  return { registros: criados, desfazer: () => desfazeres.reverse().forEach((d) => d()) };
}
