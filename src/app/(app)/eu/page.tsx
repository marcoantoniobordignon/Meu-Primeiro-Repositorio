"use client";

import { Bookmark, CalendarDays, ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Card } from "@/components/ui/Card";
import { useTema, type Tema } from "@/components/ui/ProvedorTema";
import { Sheet } from "@/components/ui/Sheet";
import { euCopy as copy } from "@/copy/eu";
import { onboarding as onbCopy } from "@/copy/onboarding";
import { track } from "@/lib/analytics";
import { todasColecoes } from "@/lib/dados/colecoes";
import { ehISOValida } from "@/lib/dates";
import { limparEstado } from "@/lib/onboarding/estado";
import { atualizarPerfil, limparPerfil, usePerfil } from "@/lib/perfil";

export default function PaginaEu() {
  const perfil = usePerfil();
  const { tema, definirTema } = useTema();
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [palavra, setPalavra] = useState("");
  if (!perfil) return null;

  function mudarTema(t: Tema) {
    definirTema(t);
    track("tema_alterado", { tema: t });
  }

  function recomecar() {
    todasColecoes.forEach((c) => c.limpar());
    limparEstado();
    limparPerfil();
    router.replace("/onboarding");
  }

  const atalho = (href: string, rotulo: string, Icone: typeof Bookmark) => (
    <Link href={href} className="flex min-h-13 items-center gap-3 px-4 text-[15px] text-texto">
      <Icone size={18} aria-hidden className="text-primaria-texto" />
      <span className="flex-1">{rotulo}</span>
      <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-5 px-5">
      <header className="safe-top">
        <h1 className="tipo-saudacao text-texto">{copy.titulo}</h1>
      </header>

      <Card>
        <div className="flex flex-col gap-4">
          <CampoTexto
            rotulo={copy.nome}
            defaultValue={perfil.nome ?? ""}
            placeholder={onbCopy.nome.placeholder}
            onBlur={(e) => atualizarPerfil({ nome: e.target.value.trim() || undefined })}
            autoComplete="given-name"
          />
          {perfil.modo === "gestacao" ? (
            <CampoTexto rotulo={copy.dpp} type="date" defaultValue={perfil.dpp ?? ""} onBlur={(e) => ehISOValida(e.target.value) && atualizarPerfil({ dpp: e.target.value })} />
          ) : (
            <CampoTexto rotulo={copy.nascimento} type="date" defaultValue={perfil.nascidoEm ?? ""} onBlur={(e) => ehISOValida(e.target.value) && atualizarPerfil({ nascidoEm: e.target.value })} />
          )}
        </div>
      </Card>

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.tema}</h2>
        <div role="radiogroup" aria-label={copy.tema} className="flex rounded-pilula bg-primaria-suave p-1">
          {(["auto", "claro", "escuro"] as Tema[]).map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={tema === t}
              onClick={() => mudarTema(t)}
              className={`min-h-10 flex-1 rounded-pilula text-[14px] font-medium transition-colors ${tema === t ? "bg-superficie text-primaria-texto" : "text-primaria-texto/80"}`}
            >
              {copy.temas[t]}
            </button>
          ))}
        </div>
      </section>

      <Card compacto>
        <div className="-mx-4 divide-y divide-fio">
          {atalho("/eu/consultas", copy.consultas, CalendarDays)}
          {atalho("/hoje/diario", copy.diario, NotebookPen)}
          {atalho("/eu/guardados", copy.guardados, Bookmark)}
        </div>
      </Card>

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.conta}</h2>
        <Card compacto>
          <p className="tipo-corpo text-texto-mudo">{perfil.anonima ? copy.anonima : "—"}</p>
        </Card>
      </section>

      <Botao variant="fantasma" onClick={() => setConfirmando(true)}>
        {copy.recomecar}
      </Botao>

      <Sheet aberto={confirmando} onFechar={() => setConfirmando(false)} titulo={copy.recomecar}>
        <p className="tipo-corpo text-texto-mudo">{copy.recomecarConfirma}</p>
        <div className="mt-4">
          <CampoTexto rotulo="" value={palavra} onChange={(e) => setPalavra(e.target.value)} autoCapitalize="none" autoFocus />
        </div>
        <div className="mt-4 flex gap-2">
          <Botao largura="total" variant="secundario" onClick={() => setConfirmando(false)}>
            {copy.cancelar}
          </Botao>
          <Botao largura="total" disabled={palavra.trim().toLowerCase() !== "apagar"} onClick={recomecar}>
            {copy.confirmar}
          </Botao>
        </div>
      </Sheet>
    </div>
  );
}
