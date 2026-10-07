"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";

import { AceitarConviteFamilia } from "@/components/features/familia/AceitarConviteFamilia";
import { AceitarConviteParceiro } from "@/components/features/parceiro/AceitarConviteParceiro";

/** Convite por link: primeiro o do parceiro (funcionalidade 12); se não for, o de avó/cuidador (spec 12). */
export default function PaginaConvite() {
  const { token } = useParams<{ token: string }>();
  const [deFamilia, setDeFamilia] = useState(false);
  const naoEhDoParceiro = useCallback(() => setDeFamilia(true), []);
  if (deFamilia) return <AceitarConviteFamilia token={token} />;
  return <AceitarConviteParceiro chave={{ token }} onInexistente={naoEhDoParceiro} />;
}
