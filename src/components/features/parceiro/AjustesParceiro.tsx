"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { track } from "@/lib/analytics";
import { sairDaGestacao } from "@/lib/parceiro/convite";
import { atualizarPerfil, type Perfil } from "@/lib/perfil";
import { prefsCompletas, type Prefs } from "@dominio/prefs.ts";

/** Tela 4 "Parceiro > Ajustes": tipos de aviso (RN-08) e sair da gestação (RN-06). */
export function AjustesParceiro({ perfil, eu }: { perfil: Perfil; eu: string }) {
  const prefs = prefsCompletas(perfil.prefs);
  const [saindo, setSaindo] = useState(false);
  const router = useRouter();
  const { mostrar } = useToast();
  const mudar = (m: Prefs) => atualizarPerfil({ prefs: { ...perfil.prefs, ...m } });

  async function sair() {
    try {
      await sairDaGestacao(eu);
      track("partner_removed", { by: "partner" });
      mostrar(copy.saiu);
      router.replace("/hoje");
    } catch {
      mostrar(copy.erro);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="tipo-titulo-secao text-texto-mudo">{copy.avisosTitulo}</h2>
      <Card compacto>
        <div className="flex flex-col divide-y divide-fio">
          <Interruptor rotulo={copy.avisos.vespera} apoio={copy.avisos.vesperaApoio} ligado={prefs.partner_appointment_eve} onMudar={(v) => mudar({ partner_appointment_eve: v })} />
          <Interruptor rotulo={copy.avisos.exame} apoio={copy.avisos.exameApoio} ligado={prefs.partner_exam_scheduled} onMudar={(v) => mudar({ partner_exam_scheduled: v })} />
          <Interruptor rotulo={copy.avisos.marcos} apoio={copy.avisos.marcosApoio} ligado={prefs.partner_milestones} onMudar={(v) => mudar({ partner_milestones: v })} />
        </div>
      </Card>
      <p className="tipo-meta">{copy.avisosLimite}</p>
      <Botao variant="fantasma" onClick={() => setSaindo(true)}>
        {copy.sair}
      </Botao>
      <SheetConfirmar aberto={saindo} titulo={copy.sairTitulo} texto={copy.sairTexto} confirmar={copy.sair} cancelar={copy.cancelar} onFechar={() => setSaindo(false)} onConfirmar={() => void sair()} />
    </section>
  );
}
