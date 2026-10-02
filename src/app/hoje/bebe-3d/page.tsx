"use client";

import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { Carregando } from "@/components/features/bebe3d/Carregando";
import { dadosDaSemana, SEMANA_MAX, SEMANA_MIN } from "@/lib/bebe3d/semanas";
import { paraISO, semanaGestacional } from "@/lib/dates";
import { usePerfil } from "@/lib/perfil";

// Lazy e sem SSR: o three.js só desce quando esta tela abre.
const Bebe3D = dynamic(() => import("@/components/features/bebe3d/Bebe3D").then((m) => m.Bebe3D), {
  ssr: false,
  loading: () => <Carregando visivel semana={20} />,
});

/** Enquanto só a fatia vertical existe, a cena abre na semana mais próxima que tem dados. */
function semanaDisponivel(semana: number): number {
  const disponiveis = [20];
  return disponiveis.reduce((melhor, s) => (Math.abs(s - semana) < Math.abs(melhor - semana) ? s : melhor), disponiveis[0]!);
}

function Conteudo() {
  const perfil = usePerfil();
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    if (perfil === null) router.replace("/onboarding");
  }, [perfil, router]);
  if (!perfil) return <div className="min-h-dvh bg-utero-fundo" aria-busy="true" />;

  const daUrl = Number(params.get("semana"));
  const doPerfil = perfil.dpp ? semanaGestacional(perfil.dpp, paraISO(new Date())).semana : 20;
  const pedida = Number.isFinite(daUrl) && daUrl >= SEMANA_MIN && daUrl <= SEMANA_MAX ? daUrl : doPerfil;
  const semana = dadosDaSemana(pedida) ? pedida : semanaDisponivel(pedida);
  return <Bebe3D semana={semana} />;
}

export default function PaginaBebe3D() {
  return (
    <Suspense fallback={<Carregando visivel semana={20} />}>
      <Conteudo />
    </Suspense>
  );
}
