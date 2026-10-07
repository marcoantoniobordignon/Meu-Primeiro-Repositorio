"use client";

import { useState } from "react";

import { Card } from "@/components/ui/Card";
import { Interruptor } from "@/components/ui/Interruptor";
import { galeriaCopy as copy } from "@/copy/galeria";
import { darConsentimento, retirarConsentimento, temConsentimento } from "@/lib/galeria/ia";
import type { Perfil } from "@/lib/perfil";

/**
 * Galeria RN-05: a permissão de leitura por IA pode ser retirada em Eu a qualquer momento.
 * Só aparece para quem já deu (o "sim" com o texto completo é dado na tela do documento);
 * fica na tela até sair, para dar para religar se tocou sem querer.
 */
export function PermissaoIa({ perfil }: { perfil: Perfil }) {
  const ligado = temConsentimento(perfil);
  const [visivel] = useState(ligado);
  if (!visivel) return null;
  return (
    <Card compacto>
      <Interruptor rotulo={copy.retirarIa} apoio={copy.retirarIaApoio} ligado={ligado} onMudar={(v) => (v ? darConsentimento(perfil) : retirarConsentimento(perfil))} />
    </Card>
  );
}
