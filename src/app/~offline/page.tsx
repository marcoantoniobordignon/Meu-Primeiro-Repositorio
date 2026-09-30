import { CloudOff } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/Botao";
import { Vazio } from "@/components/ui/Vazio";
import { redeCopy as copy } from "@/copy/rede";

/** Fallback do service worker para navegação sem cache (ARQ-04: nunca tela em branco). */
export default function PaginaOffline() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-fundo px-5">
      <Vazio
        icone={<CloudOff size={24} />}
        frase={`${copy.offlineTitulo}. ${copy.offlineApoio}`}
        acao={
          <Link href="/hoje">
            <Botao variant="secundario">{copy.voltar}</Botao>
          </Link>
        }
      />
    </div>
  );
}
