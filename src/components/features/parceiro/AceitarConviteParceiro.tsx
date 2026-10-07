"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { track } from "@/lib/analytics";
import { meuId } from "@/lib/familia/useFamilia";
import { temServidor } from "@/lib/familia/servidor";
import { guardarPerfil, lerPerfil } from "@/lib/onboarding/estado";
import { sincronizar } from "@/lib/offline/sync";
import { aceitarConvite, ErroConvite, lerConvite, type VistaConvite } from "@/lib/parceiro/convite";
import { garantirSessaoAnonima, sincronizarSessao, type Sessao } from "@/lib/sessao";
import { supabase } from "@/lib/supabase/client";

interface Props {
  chave: { token?: string; code?: string };
  /** O convite pode ser o de avó/cuidador: quem chama decide o que fazer quando este não existe. */
  onInexistente?: () => void;
}

/** Tela 2 "Aceitar convite": explica o que ele verá, pede login (RN-02) e confirma. */
export function AceitarConviteParceiro({ chave, onInexistente }: Props) {
  const router = useRouter();
  const { mostrar } = useToast();
  const [vista, setVista] = useState<VistaConvite | null>(null);
  const [sessao, setSessao] = useState<Sessao | null>(null);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [emailEnviado, setEmailEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aceitando, setAceitando] = useState(false);
  const remoto = temServidor();
  const token = chave.token;
  const code = chave.code;

  useEffect(() => {
    let vivo = true;
    void (async () => {
      await garantirSessaoAnonima();
      const s = await sincronizarSessao();
      if (vivo) setSessao(s);
      try {
        const v = await lerConvite({ token, code });
        if (!vivo) return;
        if (v.estado === "inexistente" && onInexistente) return onInexistente();
        setVista(v);
      } catch {
        if (vivo) setVista({ estado: "inexistente", quem: "" });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [token, code, onInexistente]);

  if (!vista) return <div aria-busy="true" className="min-h-dvh bg-fundo" />;
  const precisaEntrar = remoto && (sessao?.anonima ?? true);

  async function comGoogle() {
    const sb = await supabase();
    await sb?.auth.linkIdentity({ provider: "google", options: { redirectTo: location.href } });
  }

  async function comEmail() {
    if (!email.includes("@")) return;
    const sb = await supabase();
    const { error } = (await sb?.auth.updateUser({ email }, { emailRedirectTo: location.href })) ?? { error: null };
    if (error) setErro(copy.erros.desconhecido);
    else setEmailEnviado(true);
  }

  async function aceitar() {
    setAceitando(true);
    setErro(null);
    try {
      const s = await garantirSessaoAnonima();
      const n = nome.trim() || null;
      const r = await aceitarConvite({ token, code }, s.uid || meuId(), n);
      if (!lerPerfil()) guardarPerfil({ nome: n ?? undefined, modo: "gestacao", anonima: s.anonima, plano: "free", papel: "parceiro", onboardingConcluidoEm: new Date().toISOString() });
      track("partner_invite_accepted", { hours_to_accept: r.horas });
      mostrar(copy.aceito);
      if (remoto) await sincronizar();
      router.replace("/hoje");
    } catch (e) {
      const motivo = e instanceof ErroConvite ? e.motivo : "desconhecido";
      setErro(copy.erros[motivo]);
      setAceitando(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 bg-fundo px-5 py-10">
      {vista.estado !== "valido" ? (
        <Card>
          <p className="tipo-saudacao text-texto" role="alert">
            {copy.erros[vista.estado]}
          </p>
        </Card>
      ) : (
        <>
          <h1 className="tipo-pergunta text-texto">{copy.aceitarTitulo(vista.quem)}</h1>
          <Card>
            <h2 className="tipo-titulo-secao text-texto-mudo">{copy.oQueVe}</h2>
            <ul className="mt-2 flex flex-col gap-1.5">
              {copy.veLista.map((t) => (
                <li key={t} className="tipo-corpo flex gap-2 text-texto">
                  <Check size={16} aria-hidden className="mt-1 shrink-0 text-primaria-texto" />
                  {t}
                </li>
              ))}
              <li className="tipo-corpo flex gap-2 text-texto-mudo">
                <X size={16} aria-hidden className="mt-1 shrink-0" />
                {copy.naoVe}
              </li>
            </ul>
          </Card>
          {precisaEntrar ? (
            <>
              <p className="tipo-corpo text-texto-mudo">{copy.entrarParaAceitar}</p>
              <Botao largura="total" tamanho="lg" onClick={() => void comGoogle()}>
                {copy.comGoogle}
              </Botao>
              {emailEnviado ? (
                <p className="tipo-corpo text-texto" role="status">
                  {copy.linkEnviado}
                </p>
              ) : (
                <>
                  <CampoTexto rotulo={copy.email} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                  <Botao largura="total" variant="secundario" onClick={() => void comEmail()}>
                    {copy.enviarLink}
                  </Botao>
                </>
              )}
            </>
          ) : (
            <>
              <CampoTexto rotulo={copy.seuNome} value={nome} onChange={(e) => setNome(e.target.value)} autoCapitalize="words" autoComplete="given-name" />
              <Botao largura="total" tamanho="lg" carregando={aceitando} onClick={() => void aceitar()}>
                {aceitando ? copy.aceitando : copy.aceitar}
              </Botao>
            </>
          )}
          {erro && (
            <p className="text-[14px] text-erro" role="alert">
              {erro}
            </p>
          )}
        </>
      )}
    </div>
  );
}
