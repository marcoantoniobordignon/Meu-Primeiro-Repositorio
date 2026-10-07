"use client";

import { MapPin } from "lucide-react";

import { CampoAuto } from "@/components/features/plano/CampoAuto";
import { Etapa } from "@/components/features/plano/Etapa";
import { Card } from "@/components/ui/Card";
import { Escolha } from "@/components/ui/Escolha";
import { planoCopy as copy } from "@/copy/planoParto";
import type { BirthPlan } from "@/lib/dados/colecoes";
import { salvarCampos } from "@/lib/plano/acoes";
import { usePlano } from "@/lib/plano/usePlano";

/** Tela 2 "Onde": maternidade, endereço, telefone, mapa, cobertura, médico. RN-04: direito de conhecer a maternidade. */
export default function PaginaOnde() {
  const { plano, editar } = usePlano();
  return (
    <Etapa numero={1} titulo={copy.etapas.onde.titulo}>
      {plano && <Campos plano={plano} editar={editar} />}
    </Etapa>
  );
}

function Campos({ plano, editar }: { plano: BirthPlan; editar: boolean }) {
  const salvar = (k: keyof BirthPlan) => (v: string | null) => salvarCampos(plano, { [k]: v });
  return (
    <>
      <CampoAuto rotulo={copy.maternidade} valor={plano.maternity_name} onSalvar={salvar("maternity_name")} maxLength={80} desativado={!editar} />
      <CampoAuto rotulo={copy.endereco} valor={plano.maternity_address} onSalvar={salvar("maternity_address")} maxLength={160} desativado={!editar} autoComplete="street-address" />
      <CampoAuto rotulo={copy.telefone} valor={plano.maternity_phone} onSalvar={salvar("maternity_phone")} maxLength={30} desativado={!editar} tipo="tel" inputMode="tel" />
      <CampoAuto rotulo={copy.mapa} valor={plano.maternity_maps_url} onSalvar={salvar("maternity_maps_url")} maxLength={500} desativado={!editar} tipo="url" inputMode="url" />
      {plano.maternity_maps_url && /^https?:\/\//.test(plano.maternity_maps_url) && (
        <a href={plano.maternity_maps_url} target="_blank" rel="noreferrer" className="-mt-2 inline-flex min-h-11 items-center gap-2 text-[15px] font-medium text-primaria-texto">
          <MapPin size={16} aria-hidden />
          {copy.abrirMapa}
        </a>
      )}
      {editar ? (
        <Escolha
          rotulo={copy.cobertura}
          opcoes={(["sus", "private", "unknown"] as const).map((v) => ({ valor: v, rotulo: copy.coberturas[v] }))}
          valor={plano.coverage ?? ("" as "sus")}
          onMudar={(v) => salvarCampos(plano, { coverage: v })}
        />
      ) : (
        plano.coverage && <p className="tipo-corpo text-texto">{`${copy.cobertura}: ${copy.coberturas[plano.coverage]}`}</p>
      )}
      {plano.coverage === "private" && <CampoAuto rotulo={copy.convenio} valor={plano.insurer_name} onSalvar={salvar("insurer_name")} maxLength={80} desativado={!editar} />}
      <CampoAuto rotulo={copy.medico} valor={plano.doctor_name} onSalvar={salvar("doctor_name")} maxLength={80} desativado={!editar} />
      <CampoAuto rotulo={copy.telMedico} valor={plano.doctor_phone} onSalvar={salvar("doctor_phone")} maxLength={30} desativado={!editar} tipo="tel" inputMode="tel" />
      <Card tom="suave">
        <p className="tipo-corpo text-texto">{copy.direitoConhecer}</p>
      </Card>
    </>
  );
}
