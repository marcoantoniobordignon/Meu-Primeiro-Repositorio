"use client";

import { ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { Vazio } from "@/components/ui/Vazio";
import { euCopy as copy } from "@/copy/eu";
import { nav } from "@/copy/nav";
import { useFamilia } from "@/lib/familia/useFamilia";
import { usePerfil } from "@/lib/perfil";

/**
 * Na gestação, a aba abre as malas e o enxoval do plano de parto (funcionalidade 10: o enxoval
 * entra na v1 como checklist). No modo bebê, segue o placeholder que mede interesse (spec 03).
 */
export default function PaginaEnxoval() {
  const [avisado, setAvisado] = useState(false);
  const perfil = usePerfil();
  const { permissoes } = useFamilia();
  const router = useRouter();
  const naGestacao = perfil?.modo === "gestacao" && permissoes.verPlanoParto;
  useEffect(() => {
    if (naGestacao) router.replace("/plano-parto/listas");
  }, [naGestacao, router]);
  if (perfil === undefined || naGestacao) return null;
  return (
    <div>
      <header className="safe-top px-5">
        <h1 className="tipo-saudacao text-texto">{nav.enxoval}</h1>
      </header>
      <Vazio
        icone={<ShoppingBag size={24} />}
        frase={copy.placeholders.enxoval}
        acao={
          <Botao variant={avisado ? "secundario" : "primario"} disabled={avisado} onClick={() => setAvisado(true)}>
            {avisado ? copy.placeholders.avisado : copy.placeholders.meAvise}
          </Botao>
        }
      />
    </div>
  );
}
