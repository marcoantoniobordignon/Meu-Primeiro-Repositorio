"use client";

import { Phone } from "lucide-react";
import Link from "next/link";

import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { nascimentoCopy as copy } from "@/copy/nascimento";
import { usePerfil } from "@/lib/perfil";

/** Lista dos sinais que pedem contato com a equipe e o botão de ligar (tel:). */
export default function PaginaSinais() {
  const perfil = usePerfil();
  return (
    <div>
      <Cabecalho titulo={copy.sinais.titulo} />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <p className="tipo-corpo text-texto-mudo">{copy.sinais.apoio}</p>
        <Card>
          <ul className="flex flex-col gap-3">
            {copy.sinais.lista.map((s) => (
              <li key={s} className="flex gap-3">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-acento" />
                <span className="tipo-corpo text-texto">{s}</span>
              </li>
            ))}
          </ul>
          <p className="tipo-meta mt-4">{copy.sinais.fecho}</p>
        </Card>
        {perfil?.telefoneEquipe ? (
          <a href={`tel:${perfil.telefoneEquipe}`} className="block">
            <Botao largura="total" tamanho="lg" icone={<Phone size={18} aria-hidden />}>
              {copy.checkin.ligar}
            </Botao>
          </a>
        ) : (
          <Link href="/eu/bebe" className="block">
            <Botao largura="total" variant="secundario">
              {copy.checkin.semTelefone}
            </Botao>
          </Link>
        )}
      </div>
    </div>
  );
}
