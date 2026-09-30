"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { FaixaRede } from "@/components/ui/FaixaRede";
import { TabBar } from "@/components/ui/TabBar";
import { track } from "@/lib/analytics";
import { estaInstalado, estaOnline } from "@/lib/plataforma";
import { usePerfil } from "@/lib/perfil";

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

  if (!perfil) return <div className="min-h-dvh bg-fundo" aria-busy="true" />;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-fundo pb-[calc(env(safe-area-inset-bottom,0px)+88px)]">
      <FaixaRede />
      {children}
      <TabBar />
    </div>
  );
}
