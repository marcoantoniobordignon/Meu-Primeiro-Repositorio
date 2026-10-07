"use client";

import { CampoAuto } from "@/components/features/plano/CampoAuto";
import { Etapa } from "@/components/features/plano/Etapa";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { Interruptor } from "@/components/ui/Interruptor";
import { planoCopy as copy } from "@/copy/planoParto";
import type { BirthPlan } from "@/lib/dados/colecoes";
import { salvarCampos } from "@/lib/plano/acoes";
import { usePlano } from "@/lib/plano/usePlano";
import { PREFS_BOOLEANAS, type PrefsParto } from "@dominio/plano-parto.ts";

/** Tela 3 "Como": tipo de parto desejado e preferências como desejos (RN-03). */
export default function PaginaComo() {
  const { plano, editar } = usePlano();
  return (
    <Etapa numero={2} titulo={copy.etapas.como.titulo}>
      {plano && <Campos plano={plano} editar={editar} />}
    </Etapa>
  );
}

function Campos({ plano, editar }: { plano: BirthPlan; editar: boolean }) {
  const prefs = plano.prefs ?? {};
  const mudarPref = (m: PrefsParto) => salvarCampos(plano, { prefs: { ...prefs, ...m } });
  return (
    <>
      <Card tom="acento">
        <p className="tipo-corpo text-texto" role="note">
          {copy.comoAviso}
        </p>
      </Card>
      <fieldset disabled={!editar} className="contents">
      <Escolha rotulo={copy.partoDesejado} opcoes={(["vaginal", "cesarean", "open", "undecided"] as const).map((v) => ({ valor: v, rotulo: copy.partos[v] }))} valor={plano.wished_delivery} onMudar={(v) => editar && salvarCampos(plano, { wished_delivery: v })} />
      <Escolha rotulo={copy.analgesia} opcoes={(["none", "epidural", "open", "undecided"] as const).map((v) => ({ valor: v, rotulo: copy.analgesias[v] }))} valor={prefs.analgesia ?? "undecided"} onMudar={(v) => editar && mudarPref({ analgesia: v })} />
      </fieldset>
      <Card compacto>
        <div className="flex flex-col divide-y divide-fio">
          {PREFS_BOOLEANAS.map((k) => (
            <Interruptor key={k} rotulo={copy.prefs[k]} apoio={copy.prefsApoio[k]} ligado={Boolean(prefs[k])} desativado={!editar} onMudar={(v) => mudarPref({ [k]: v })} />
          ))}
        </div>
      </Card>
      <fieldset disabled={!editar} className="contents">
        <Escolha rotulo={copy.fotos} opcoes={(["allowed", "no"] as const).map((v) => ({ valor: v, rotulo: copy.fotosOpcoes[v] }))} valor={prefs.photos_video ?? ("" as "allowed")} onMudar={(v) => editar && mudarPref({ photos_video: v })} />
      </fieldset>
      <CampoAuto area rotulo={copy.observacoes} valor={plano.notes} onSalvar={(v) => salvarCampos(plano, { notes: v })} maxLength={1000} desativado={!editar} />
    </>
  );
}
