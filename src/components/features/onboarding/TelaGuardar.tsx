"use client";

import { Check, Mail } from "lucide-react";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { onboarding as copy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { idadeBebe, paraISO, semanaGestacional } from "@/lib/dates";
import { supabase } from "@/lib/supabase/client";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

/** Tela 7: guardar a linha do tempo. Pular mantém a sessão anônima (ONB-06). */
export function TelaGuardar({ estado, avancar }: PropsTela) {
  const hoje = paraISO(new Date());
  const primeiraLinha =
    estado.momento === "bebe" && estado.nascidoEm
      ? copy.guardar.oQueFica.bebe(idadeBebe(estado.nascidoEm, hoje).dias)
      : copy.guardar.oQueFica.gestacao(estado.dpp ? semanaGestacional(estado.dpp, hoje).semana : 0);
  const oQueFica = [primeiraLinha, copy.guardar.oQueFica.diario(estado.sintomas?.length ?? 0), copy.guardar.oQueFica.depois];
  const [modoEmail, setModoEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [aviso, setAviso] = useState("");

  async function comGoogle() {
    track("onb_cadastro", { metodo: "google" });
    const sb = await supabase();
    if (!sb) {
      setAviso(copy.guardar.semServidor);
      return;
    }
    // ARQ-03: linkIdentity preserva o uid anônimo; nada migra.
    await sb.auth.linkIdentity({ provider: "google", options: { redirectTo: `${location.origin}/hoje` } });
  }

  async function comEmail() {
    if (!email.includes("@")) return;
    track("onb_cadastro", { metodo: "email" });
    const sb = await supabase();
    if (!sb) {
      setAviso(copy.guardar.semServidor);
      return;
    }
    setEnviando(true);
    try {
      await sb.auth.updateUser({ email });
      setEnviado(true);
    } catch {
      setAviso(copy.guardar.semServidor);
    } finally {
      setEnviando(false);
    }
  }

  function agoraNao() {
    track("onb_cadastro", { metodo: "pulou" });
    avancar();
  }

  return (
    <Pergunta
      titulo={copy.guardar.pergunta}
      apoio={copy.guardar.apoio}
      rodape={
        <div className="flex flex-col gap-2">
          {enviado || aviso ? (
            <Botao tamanho="lg" largura="total" onClick={() => avancar()}>
              {copy.continuar}
            </Botao>
          ) : modoEmail ? (
            <Botao
              tamanho="lg"
              largura="total"
              onClick={comEmail}
              carregando={enviando}
              disabled={!email.includes("@")}
            >
              {copy.guardar.enviarLink}
            </Botao>
          ) : (
            <>
              <Botao tamanho="lg" largura="total" icone={<IconeGoogle />} onClick={comGoogle}>
                {copy.guardar.google}
              </Botao>
              <Botao
                variant="secundario"
                tamanho="lg"
                largura="total"
                icone={<Mail size={18} aria-hidden />}
                onClick={() => setModoEmail(true)}
              >
                {copy.guardar.email}
              </Botao>
            </>
          )}
          {!enviado && !aviso && (
            <Botao variant="fantasma" largura="total" onClick={agoraNao}>
              {copy.guardar.agoraNao}
            </Botao>
          )}
        </div>
      }
    >
      {enviado ? (
        <Card tom="suave">
          <p className="tipo-corpo text-primaria-texto">{copy.guardar.linkEnviado}</p>
        </Card>
      ) : aviso ? (
        <Card tom="suave">
          <p className="tipo-corpo text-primaria-texto">{aviso}</p>
        </Card>
      ) : modoEmail ? (
        <CampoTexto
          rotulo={copy.guardar.rotuloEmail}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
      ) : (
        <Card>
          <p className="tipo-titulo-secao text-texto-mudo">{copy.guardar.oQueFicaTitulo}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {oQueFica.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <span aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-primaria-suave text-primaria-texto">
                  <Check size={14} strokeWidth={3} />
                </span>
                <span className="tipo-corpo text-texto">{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Pergunta>
  );
}

function IconeGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="currentColor"
        d="M21.6 12.2c0-.7-.1-1.3-.2-1.9H12v3.7h5.4c-.2 1.2-.9 2.2-1.9 2.9v2.4h3.1c1.8-1.7 2.9-4.1 2.9-7.1z"
      />
      <path
        fill="currentColor"
        opacity=".8"
        d="M12 22c2.7 0 5-.9 6.6-2.4l-3.1-2.4c-.9.6-2 .9-3.5.9-2.6 0-4.9-1.8-5.7-4.2H3.1v2.5C4.8 19.7 8.1 22 12 22z"
      />
      <path fill="currentColor" opacity=".6" d="M6.3 13.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V7.6H3.1C2.4 8.9 2 10.4 2 12s.4 3.1 1.1 4.4l3.2-2.5z" />
      <path
        fill="currentColor"
        opacity=".7"
        d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8C17 3 14.7 2 12 2 8.1 2 4.8 4.3 3.1 7.6l3.2 2.5C7.1 7.7 9.4 5.9 12 5.9z"
      />
    </svg>
  );
}
