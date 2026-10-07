"use client";

import { useCallback, useEffect, useState } from "react";

import { chamarRpc, supabase, supabaseConfigurado } from "@/lib/supabase/client";

export type EstadoAdmin =
  | { estado: "carregando" }
  | { estado: "demo" }
  | { estado: "anonimo" }
  | { estado: "sem_permissao"; email: string }
  | { estado: "admin"; email: string }
  /** Funcionalidade 09: revisora do FAQ (profiles.is_reviewer) só vê o FAQ. */
  | { estado: "revisor"; email: string };

/**
 * Quem pode ver o painel: uma conta com e-mail que esteja na tabela admins
 * (eh_admin() lê o e-mail do JWT). Sem Supabase, o painel roda em demonstração.
 */
async function lerEstado(): Promise<EstadoAdmin> {
  if (!supabaseConfigurado()) return { estado: "demo" };
  const sb = await supabase();
  if (!sb) return { estado: "demo" };
  const { data } = await sb.auth.getSession();
  const user = data.session?.user;
  if (!user || user.is_anonymous || !user.email) return { estado: "anonimo" };
  const { data: eu } = await chamarRpc<{ email: string; admin: boolean; revisor?: boolean }>(sb, "admin_eu");
  if (eu?.admin) return { estado: "admin", email: user.email };
  if (eu?.revisor) return { estado: "revisor", email: user.email };
  return { estado: "sem_permissao", email: user.email };
}

export function useSessaoAdmin() {
  const [estado, setEstado] = useState<EstadoAdmin>({ estado: "carregando" });

  useEffect(() => {
    let vivo = true;
    void lerEstado().then((e) => vivo && setEstado(e));
    let cancelar: (() => void) | undefined;
    void supabase().then((sb) => {
      if (!sb || !vivo) return;
      const { data } = sb.auth.onAuthStateChange(() => {
        void lerEstado().then((e) => vivo && setEstado(e));
      });
      cancelar = () => data.subscription.unsubscribe();
    });
    return () => {
      vivo = false;
      cancelar?.();
    };
  }, []);

  /** Link mágico por e-mail; volta para /admin no mesmo navegador. */
  const entrar = useCallback(async (email: string): Promise<boolean> => {
    const sb = await supabase();
    if (!sb) return false;
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/admin` } });
    return !error;
  }, []);

  const sair = useCallback(async () => {
    const sb = await supabase();
    await sb?.auth.signOut();
    setEstado({ estado: "anonimo" });
  }, []);

  return { ...estado, entrar, sair };
}
