"use client";

import { ExternalLink, Phone } from "lucide-react";

import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { direitosCopy as copy } from "@/copy/direitos";
import { track } from "@/lib/analytics";
import { useDireitos } from "@/lib/direitos/useDireitos";
import { linkTelefone, telefoneLegivel } from "@dominio/direitos.ts";

/** Tela 3 "Onde buscar ajuda": cada canal com o botão de ligar (abre o discador) e o site. */
export default function PaginaAjuda() {
  const { canais } = useDireitos();
  return (
    <div>
      <Cabecalho titulo={copy.canais.titulo} voltarPara="/direitos" />
      <div className="flex flex-col gap-3 px-5 pb-8 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.canais.apoio}</p>
        {canais.length === 0 && (
          <Card>
            <p className="tipo-corpo text-texto-mudo">{copy.canais.vazio}</p>
          </Card>
        )}
        {canais.some((c) => c.rascunho) && <span className="self-start rounded-pilula bg-acento-suave px-2 py-0.5 text-[12px] font-medium text-texto">{copy.canais.rascunho}</span>}
        {canais.map((c) => {
          const tel = linkTelefone(c.phone);
          return (
            <Card key={c.id}>
              <h2 className="text-[16px] font-medium text-texto">{c.name}</h2>
              <p className="tipo-corpo mt-0.5 text-texto-mudo">{c.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tel && (
                  <a
                    href={tel}
                    aria-label={copy.canais.ligar(c.name, telefoneLegivel(c.phone!))}
                    onClick={() => track("rights_help_channel_tapped", { channel: c.slug })}
                    className="inline-flex min-h-11 items-center gap-2 rounded-pilula bg-primaria-suave px-4 text-[15px] font-medium text-primaria-texto"
                  >
                    <Phone size={16} aria-hidden />
                    {telefoneLegivel(c.phone!)}
                  </a>
                )}
                {c.url && (
                  <a href={c.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 px-2 text-[15px] font-medium text-primaria-texto">
                    <ExternalLink size={16} aria-hidden />
                    {copy.canais.site}
                  </a>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
