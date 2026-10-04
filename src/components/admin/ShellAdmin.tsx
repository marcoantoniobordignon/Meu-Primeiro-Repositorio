"use client";

import { BookOpen, ExternalLink, FlaskConical, LayoutDashboard, LogOut, Mic, Moon, Settings, Sun, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { useTema } from "@/components/ui/ProvedorTema";
import { adminCopy as copy } from "@/copy/admin";
import { useSessaoAdmin } from "@/lib/admin/sessao";

const secoes = [
  { href: "/admin", rotulo: copy.nav.visao, Icone: LayoutDashboard },
  { href: "/admin/usuarias", rotulo: copy.nav.usuarias, Icone: Users },
  { href: "/admin/conteudo", rotulo: copy.nav.conteudo, Icone: BookOpen },
  { href: "/admin/voz", rotulo: copy.nav.voz, Icone: Mic },
  { href: "/admin/sistema", rotulo: copy.nav.sistema, Icone: Settings },
] as const;

/**
 * Casca do painel: barra lateral no desktop, abas no topo no celular.
 * Só entra quem está na tabela admins; sem Supabase, roda em demonstração com faixa.
 */
export function ShellAdmin({ children }: { children: ReactNode }) {
  const sessao = useSessaoAdmin();
  const caminho = usePathname();
  const { tema, definirTema } = useTema();
  const escuro = tema === "escuro";

  if (sessao.estado === "carregando") return <div className="min-h-dvh bg-fundo" aria-busy="true" />;
  if (sessao.estado === "anonimo" || sessao.estado === "sem_permissao") {
    return <Entrar emailSemPermissao={sessao.estado === "sem_permissao" ? sessao.email : null} entrar={sessao.entrar} sair={sessao.sair} />;
  }

  const ativa = (href: string) => (href === "/admin" ? caminho === href : caminho.startsWith(href));

  const item = ({ href, rotulo, Icone }: (typeof secoes)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={ativa(href) ? "page" : undefined}
      className={`flex min-h-11 shrink-0 items-center gap-2.5 rounded-pilula px-3.5 text-[14px] font-medium transition-colors ${
        ativa(href) ? "bg-primaria-suave text-primaria-texto" : "text-texto-mudo hover:bg-superficie hover:text-texto"
      }`}
    >
      <Icone size={18} strokeWidth={ativa(href) ? 2.2 : 1.8} />
      {rotulo}
    </Link>
  );

  return (
    <div className="min-h-dvh bg-fundo text-texto">
      {sessao.estado === "demo" && (
        <div role="status" className="flex items-center justify-center gap-2 bg-acento-suave px-4 py-2 text-center text-[12px] text-texto">
          <FlaskConical size={14} aria-hidden />
          <span>{copy.demo.faixa}</span>
          <Link href="/admin/sistema" className="font-medium text-primaria-texto underline-offset-2 hover:underline">
            {copy.demo.comoLigar}
          </Link>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-[1200px] flex-col md:flex-row">
        <aside className="safe-top sticky top-0 z-20 shrink-0 bg-fundo md:h-dvh md:w-56 md:px-4 md:pb-4">
          <div className="flex items-center justify-between px-4 md:px-2">
            <Link href="/admin" className="flex items-center gap-2">
              <span aria-hidden className="grid size-8 place-items-center rounded-full bg-primaria text-[13px] font-semibold text-white">N</span>
              <span className="tipo-saudacao">{copy.titulo}</span>
            </Link>
            <button
              type="button"
              onClick={() => definirTema(escuro ? "claro" : "escuro")}
              aria-label={escuro ? "Tema claro" : "Tema escuro"}
              className="grid size-11 place-items-center rounded-pilula text-texto-mudo hover:bg-superficie"
            >
              {escuro ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
          <nav aria-label={copy.nav.rotulo} className="scroll-x-sem-barra mt-2 flex gap-1 px-3 pb-2 md:mt-6 md:flex-col md:px-0 md:pb-0">
            {secoes.map(item)}
          </nav>
          <div className="hidden md:mt-auto md:flex md:flex-col md:gap-1 md:pt-6">
            <Link href="/hoje" className="flex min-h-11 items-center gap-2.5 rounded-pilula px-3.5 text-[13px] text-texto-mudo hover:text-texto">
              <ExternalLink size={16} />
              {copy.nav.voltarApp}
            </Link>
            {sessao.estado === "admin" && (
              <button type="button" onClick={() => void sessao.sair()} className="flex min-h-11 items-center gap-2.5 rounded-pilula px-3.5 text-left text-[13px] text-texto-mudo hover:text-texto">
                <LogOut size={16} />
                {copy.nav.sair}
              </button>
            )}
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-16 pt-2 md:px-6 md:pt-6">{children}</main>
      </div>
    </div>
  );
}

function Entrar({ emailSemPermissao, entrar, sair }: { emailSemPermissao: string | null; entrar: (email: string) => Promise<boolean>; sair: () => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "enviado" | "erro">("parado");

  async function enviar() {
    setEstado("enviando");
    setEstado((await entrar(email.trim())) ? "enviado" : "erro");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-primaria text-[16px] font-semibold text-white">N</span>
      <h1 className="tipo-pergunta mt-5 text-texto">{copy.entrar.titulo}</h1>
      {emailSemPermissao ? (
        <>
          <p className="tipo-corpo mt-3 text-texto-mudo">{copy.entrar.semPermissao(emailSemPermissao)}</p>
          <div className="mt-6">
            <Botao variant="secundario" onClick={() => void sair()}>
              {copy.entrar.trocarConta}
            </Botao>
          </div>
        </>
      ) : estado === "enviado" ? (
        <p className="tipo-corpo mt-3 text-primaria-texto">{copy.entrar.enviado}</p>
      ) : (
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
        >
          <p className="tipo-corpo text-texto-mudo">{copy.entrar.apoio}</p>
          <CampoTexto rotulo={copy.entrar.rotuloEmail} type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} erro={estado === "erro" ? copy.entrar.erro : undefined} autoFocus />
          <Botao type="submit" tamanho="lg" largura="total" carregando={estado === "enviando"} disabled={!email.includes("@")}>
            {copy.entrar.enviar}
          </Botao>
        </form>
      )}
    </div>
  );
}
