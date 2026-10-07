"use client";

import { BellRing } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { euCopy as copy } from "@/copy/eu";
import { ativarPush, estadoPush, type EstadoPush } from "@/lib/lembretes/push";

/** Liga os avisos neste aparelho (permissão + inscrição de push). */
export function AtivarAvisos() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [pedindo, setPedindo] = useState(false);
  useEffect(() => setEstado(estadoPush()), []);
  if (!estado || estado === "sem_suporte") return null;
  if (estado === "ativo") return <p className="tipo-meta flex min-h-11 items-center gap-2">{copy.avisosAtivos}</p>;
  if (estado === "negado") return <p className="tipo-meta flex min-h-11 items-center">{copy.avisosNegados}</p>;
  return (
    <div className="py-2">
      <Botao
        variant="secundario"
        carregando={pedindo}
        icone={<BellRing size={16} aria-hidden />}
        onClick={async () => {
          setPedindo(true);
          setEstado(await ativarPush());
          setPedindo(false);
        }}
      >
        {copy.ativarAvisos}
      </Botao>
    </div>
  );
}
