"use client";

import { Baby } from "lucide-react";

import { Botao } from "@/components/ui/Botao";
import { useToast } from "@/components/ui/Toast";
import { Vazio } from "@/components/ui/Vazio";
import { euCopy as copy } from "@/copy/eu";
import { home as homeCopy } from "@/copy/home";
import { nav } from "@/copy/nav";
import { usePerfil } from "@/lib/perfil";

/** NAV-02: em modo gestação, estado vazio com "Registrar nascimento" (spec 11 implementa). */
export default function PaginaBebe() {
  const perfil = usePerfil();
  const { mostrar } = useToast();
  return (
    <div>
      <header className="safe-top px-5">
        <h1 className="tipo-saudacao text-texto">{nav.bebe}</h1>
      </header>
      {perfil?.modo === "bebe" ? (
        <p className="tipo-corpo px-5 pt-4 text-texto-mudo">{homeCopy.bebe.emBreve}</p>
      ) : (
        <Vazio icone={<Baby size={24} />} frase={copy.placeholders.bebe} acao={<Botao onClick={() => mostrar(homeCopy.bebe.emBreve)}>{copy.placeholders.registrarNascimento}</Botao>} />
      )}
    </div>
  );
}
