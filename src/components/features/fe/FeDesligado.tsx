import Link from "next/link";

import { Card } from "@/components/ui/Card";
import { feCopy as copy } from "@/copy/fe";

/** RN-02: com o modo desligado, as telas de fé não mostram nada (os favoritos ficam guardados). */
export function FeDesligado() {
  return (
    <div className="px-5 pt-2">
      <Card>
        <h2 className="text-[16px] font-medium text-texto">{copy.desligado.titulo}</h2>
        <p className="tipo-corpo mt-1 text-texto-mudo">{copy.desligado.texto}</p>
        <Link href="/eu" className="mt-2 inline-flex min-h-11 items-center text-[15px] font-medium text-primaria-texto">
          {copy.desligado.ir}
        </Link>
      </Card>
    </div>
  );
}
