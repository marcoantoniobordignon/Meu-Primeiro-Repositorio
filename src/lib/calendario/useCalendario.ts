"use client";

import { useColecao } from "@/lib/dados/colecao";
import { appointments, bellyPhotos, calendarEvents, medicationDoses, userExams } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { usePerfil } from "@/lib/perfil";
import { itensDoCalendario } from "@dominio/calendario.ts";
import { dataNoFuso } from "@dominio/tempo.ts";

/** Tudo derivado das coleções do aparelho: funciona sem rede (lê o que já carregou). */
export function useCalendario() {
  const perfil = usePerfil();
  const { papel, permissoes, meuId } = useFamilia();
  const tz = useFuso();
  const consultas = useColecao(appointments);
  const exames = useColecao(userExams);
  const eventos = useColecao(calendarEvents);
  const doses = useColecao(medicationDoses);
  const fotos = useColecao(bellyPhotos);
  const hoje = dataNoFuso(new Date(), tz);
  const dpp = perfil?.modo === "gestacao" ? (perfil.dpp ?? null) : null;
  const itens = itensDoCalendario(
    { consultas, exames, eventos, doses, semanasComFoto: fotos.map((f) => f.gest_week), dpp },
    { tz, hoje, papel: papel === "mae" ? "mae" : papel === "parceiro" ? "parceiro" : "outro", agenda: permissoes.verAgenda },
  );
  return { perfil, itens, eventos, hoje, tz, dpp, papel, meuId, podeCriar: papel === "mae" };
}
