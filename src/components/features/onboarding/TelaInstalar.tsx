"use client";

import { BellRing, Check, Download } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { onboarding as copy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { detectarSistema, estaInstalado, suportaPush, type Sistema } from "@/lib/plataforma";

import type { PropsTela } from "./FluxoOnboarding";
import { Pergunta } from "./Pergunta";

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Tela 7: instalar e avisar. Push só depois de instalado (ONB-05). */
export function TelaInstalar({ avancar }: PropsTela) {
  const [sistema, setSistema] = useState<Sistema>("outro");
  const [instalado, setInstalado] = useState(false);
  const [promptInstalar, setPromptInstalar] = useState<EventoInstalar | null>(null);
  const [pedindo, setPedindo] = useState(false);

  useEffect(() => {
    const s = detectarSistema();
    setSistema(s);
    setInstalado(estaInstalado());
    track("onb_instalacao_mostrada", { sistema: s });

    const aoPoderInstalar = (e: Event) => {
      e.preventDefault();
      setPromptInstalar(e as EventoInstalar);
    };
    const aoInstalar = () => setInstalado(true);
    window.addEventListener("beforeinstallprompt", aoPoderInstalar);
    window.addEventListener("appinstalled", aoInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", aoPoderInstalar);
      window.removeEventListener("appinstalled", aoInstalar);
    };
  }, []);

  async function instalarAgora() {
    if (!promptInstalar) return;
    await promptInstalar.prompt();
    const { outcome } = await promptInstalar.userChoice;
    if (outcome === "accepted") setInstalado(true);
    setPromptInstalar(null);
  }

  async function pedirPush() {
    if (!suportaPush()) {
      avancar({ pushPermitido: false });
      return;
    }
    setPedindo(true);
    try {
      const resultado = await Notification.requestPermission();
      const permitido = resultado === "granted";
      track("onb_push_permitido", { permitido });
      avancar({ pushPermitido: permitido });
    } catch {
      avancar({ pushPermitido: false });
    } finally {
      setPedindo(false);
    }
  }

  const instrucoes = copy.instalar[sistema];

  return (
    <Pergunta
      titulo={instalado ? copy.instalar.pushTitulo : copy.instalar.pergunta}
      apoio={instalado ? copy.instalar.pushApoio : copy.instalar.apoio}
      rodape={
        instalado ? (
          <div className="flex flex-col gap-2">
            <Botao tamanho="lg" largura="total" icone={<BellRing size={18} aria-hidden />} onClick={pedirPush} carregando={pedindo}>
              {copy.instalar.pushSim}
            </Botao>
            <Botao variant="fantasma" largura="total" onClick={() => avancar({ pushPermitido: false })}>
              {copy.instalar.pushNao}
            </Botao>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {promptInstalar ? (
              <Botao tamanho="lg" largura="total" icone={<Download size={18} aria-hidden />} onClick={instalarAgora}>
                {copy.instalar.instalarAgora}
              </Botao>
            ) : (
              <Botao tamanho="lg" largura="total" onClick={() => setInstalado(true)}>
                {copy.instalar.jaInstalei}
              </Botao>
            )}
          </div>
        )
      }
    >
      {instalado ? (
        <Card tom="suave">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-7 place-items-center rounded-full bg-sucesso text-white">
              <Check size={14} strokeWidth={3} />
            </span>
            <p className="tipo-corpo text-texto">{copy.instalar.instalado}</p>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="tipo-titulo-secao text-texto-mudo">{instrucoes.titulo}</p>
          <ol className="mt-3 flex flex-col gap-3">
            {instrucoes.passos.map((passo, i) => (
              <li key={passo} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-7 shrink-0 place-items-center rounded-full bg-primaria-suave text-[12px] font-medium text-primaria-texto"
                >
                  {i + 1}
                </span>
                <span className="tipo-corpo text-texto">{passo}</span>
              </li>
            ))}
          </ol>
          {!suportaPush() && <p className="tipo-meta mt-4">{copy.instalar.pushIndisponivel}</p>}
        </Card>
      )}
    </Pergunta>
  );
}
