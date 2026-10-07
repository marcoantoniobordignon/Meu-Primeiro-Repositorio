"use client";

import Link from "next/link";

import { CampoAuto } from "@/components/features/plano/CampoAuto";
import { Etapa } from "@/components/features/plano/Etapa";
import { Card } from "@/components/ui/Card";
import { planoCopy as copy } from "@/copy/planoParto";
import type { BirthPlan } from "@/lib/dados/colecoes";
import { salvarCampos } from "@/lib/plano/acoes";
import { usePlano } from "@/lib/plano/usePlano";

/** Tela 4 "Quem": acompanhante, doula, contato de emergência. RN-04: Lei 11.108/2005. */
export default function PaginaQuem() {
  const { plano, editar } = usePlano();
  return (
    <Etapa numero={3} titulo={copy.etapas.quem.titulo}>
      {plano && <Campos plano={plano} editar={editar} />}
    </Etapa>
  );
}

function Campos({ plano, editar }: { plano: BirthPlan; editar: boolean }) {
  const salvar = (k: keyof BirthPlan) => (v: string | null) => salvarCampos(plano, { [k]: v });
  const par = (titulo: string, nome: keyof BirthPlan, tel: keyof BirthPlan) => (
    <section className="flex flex-col gap-3">
      <h2 className="tipo-titulo-secao text-texto-mudo">{titulo}</h2>
      <CampoAuto rotulo={`${copy.nome} · ${titulo}`} valor={plano[nome] as string | null} onSalvar={salvar(nome)} maxLength={80} desativado={!editar} />
      <CampoAuto rotulo={`${copy.tel} · ${titulo}`} valor={plano[tel] as string | null} onSalvar={salvar(tel)} maxLength={30} desativado={!editar} tipo="tel" inputMode="tel" />
    </section>
  );
  return (
    <>
      <Card tom="suave">
        <p className="tipo-corpo text-texto">{copy.direitoAcompanhante}</p>
        {/* Funcionalidade 16 RN-08: o cartão de direito correspondente. */}
        <Link href="/direitos/cartao?slug=acompanhante-no-parto&de=link" className="mt-1 inline-flex min-h-11 items-center text-[15px] font-medium text-primaria-texto">
          {copy.verDireito}
        </Link>
      </Card>
      {par(copy.acompanhante, "companion_name", "companion_phone")}
      {par(copy.doula, "doula_name", "doula_phone")}
      {par(copy.emergencia, "emergency_name", "emergency_phone")}
    </>
  );
}
