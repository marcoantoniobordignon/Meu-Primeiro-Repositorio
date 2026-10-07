"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FaixaRede } from "@/components/ui/FaixaRede";
import { TabBar } from "@/components/ui/TabBar";
import { track } from "@/lib/analytics";
import { useManutencaoExames } from "@/lib/exames/acoes";
import { useContextoExames } from "@/lib/exames/useExames";
import { meuId } from "@/lib/familia/useFamilia";
import { useLembretesNoAparelho } from "@/lib/lembretes/local";
import { garantirInscricao } from "@/lib/lembretes/push";
import { fusoDe, fusoDoAparelho, useManutencaoDoses } from "@/lib/medicamentos/acoes";
import { estaInstalado, estaOnline } from "@/lib/plataforma";
import { atualizarPerfil, usePerfil } from "@/lib/perfil";

/** Shell autenticado: sem perfil, tudo cai no onboarding (NAV-06). */
export default function LayoutApp({ children }: { children: React.ReactNode }) {
  const perfil = usePerfil();
  const router = useRouter();

  useEffect(() => {
    if (perfil === null) router.replace("/onboarding");
  }, [perfil, router]);

  const modo = perfil?.modo;
  useEffect(() => {
    if (modo) track("app_aberto", { modo, standalone: estaInstalado(), online: estaOnline() });
    // Uma vez por abertura: só o modo dispara.
  }, [modo]);

  // Medicamentos RN-03: o fuso do aparelho vira `profiles.tz`; mudou, as doses futuras se recalculam.
  const tz = perfil?.tz;
  useEffect(() => {
    if (perfil && tz !== fusoDoAparelho()) atualizarPerfil({ tz: fusoDoAparelho() });
  }, [perfil, tz]);
  const gestante = Boolean(perfil) && (perfil?.papel ?? "mae") === "mae";
  useManutencaoDoses(tz, gestante);
  // Exames RN-01/02: a lista nasce com a gestação e acompanha a DUM.
  const ctxExames = useContextoExames();
  useManutencaoExames(gestante ? ctxExames : null);
  useLembretesNoAparelho(gestante ? perfil : null, meuId(), fusoDe(tz));
  useEffect(() => {
    if (gestante) void garantirInscricao();
  }, [gestante]);

  if (!perfil) return <div className="min-h-dvh bg-fundo" aria-busy="true" />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-fundo pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
      <FaixaRede />
      {children}
      <TabBar />
    </div>
  );
}
