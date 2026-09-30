"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { lerPerfil } from "@/lib/onboarding/estado";

/** NAV-06: sem perfil, tudo cai no onboarding. Com perfil, vai para Hoje. */
export default function Raiz() {
  const router = useRouter();
  useEffect(() => {
    router.replace(lerPerfil() ? "/hoje" : "/onboarding");
  }, [router]);
  return <div className="min-h-dvh bg-fundo" aria-busy="true" />;
}
