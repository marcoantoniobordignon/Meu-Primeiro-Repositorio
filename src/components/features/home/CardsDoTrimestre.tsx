"use client";

import { Apple, BookOpen, Camera, Check, ChevronRight, ClipboardList, FlaskConical, Luggage, NotebookPen, Pill, Scale } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { CardConsulta } from "@/components/features/home/CardConsulta";
import { AnelSemana } from "@/components/features/home/AnelSemana";
import { artigosCopy } from "@/copy/artigos";
import { track } from "@/lib/analytics";
import { useHomeDoTrimestre } from "@/lib/artigos/useHome";
import type { SemanaGestacional } from "@/lib/dates";
import type { Perfil } from "@/lib/perfil";
import type { CardDaHome, CardHome } from "@dominio/trimestre.ts";

const copy = artigosCopy.home;

interface Atalho {
  href: string;
  icone: ReactNode;
  titulo: string;
  texto: string;
}

/** Um card da home: a linha toda é o alvo de toque; feito leva check e desce para o fim (RN-02). */
function CardAtalho({ a, feito, onToque }: { a: Atalho; feito: boolean; onToque: () => void }) {
  return (
    <Link
      href={a.href}
      onClick={onToque}
      data-card
      className={`flex min-h-16 items-center gap-3 rounded-card bg-superficie px-4 py-3 [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio ${feito ? "opacity-80" : ""}`}
    >
      <span aria-hidden className={`grid size-10 shrink-0 place-items-center rounded-full ${feito ? "bg-sucesso text-superficie" : "bg-primaria-suave text-primaria-texto"}`}>
        {feito ? <Check size={18} /> : a.icone}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-texto">{a.titulo}</span>
        <span className="tipo-meta block">{a.texto}</span>
      </span>
      {feito ? <span className="sr-only">{copy.feito}</span> : <ChevronRight size={18} aria-hidden className="shrink-0 text-texto-mudo" />}
    </Link>
  );
}

/** Funcionalidade 11 · Tela 1: anel da semana e até 6 cards na ordem do trimestre (RN-02). */
export function CardsDoTrimestre({ perfil, g }: { perfil: Perfil; g: SemanaGestacional }) {
  const { cards, detalhes, tri } = useHomeDoTrimestre(perfil.dpp!, g.semana, perfil.prefs);

  const atalho = (c: CardDaHome): Atalho | null => {
    const e = c.estado;
    switch (c.card) {
      case "exames":
        return { href: "/exames", icone: <FlaskConical size={18} />, titulo: copy.exames.titulo, texto: e === "vazio" ? copy.exames.vazio : e === "pendente" ? copy.exames.pendente(detalhes.exames) : copy.exames.normal };
      case "medicamentos":
        return {
          href: e === "vazio" ? "/medicamentos/novo" : "/medicamentos",
          icone: <Pill size={18} />,
          titulo: copy.medicamentos.titulo,
          texto: e === "vazio" ? copy.medicamentos.vazio : e === "feito" ? copy.medicamentos.feito : e === "pendente" ? copy.medicamentos.pendente(detalhes.doses.tomadas, detalhes.doses.total) : copy.medicamentos.normal,
        };
      case "marco":
        return detalhes.marco
          ? { href: `/diario/escrever?marco=${detalhes.marco.code}`, icone: <NotebookPen size={18} />, titulo: detalhes.marco.title, texto: copy.marco.titulo }
          : { href: e === "vazio" ? "/diario/escrever" : "/diario", icone: <NotebookPen size={18} />, titulo: copy.marco.titulo, texto: e === "vazio" ? copy.marco.vazio : copy.marco.normal };
      case "foto": {
        const s = detalhes.semanaFoto ?? g.semana;
        return { href: "/barriga", icone: <Camera size={18} />, titulo: copy.foto.titulo, texto: e === "feito" ? copy.foto.feito(s) : copy.foto.pendente(s) };
      }
      case "plano_parto":
        return { href: "/plano-parto", icone: <ClipboardList size={18} />, titulo: copy.plano.titulo, texto: e === "feito" ? copy.plano.feito : detalhes.plano === 0 ? copy.plano.comecar : copy.plano.progresso(detalhes.plano) };
      case "mala":
        return { href: "/plano-parto/listas", icone: <Luggage size={18} />, titulo: copy.mala.titulo, texto: e === "feito" ? copy.mala.feito : detalhes.mala.total === 0 ? copy.mala.comecar : copy.mala.progresso(detalhes.mala.feitos, detalhes.mala.total) };
      case "artigo":
        return detalhes.artigo
          ? { href: `/artigos/ler?slug=${detalhes.artigo.slug}&de=home`, icone: <BookOpen size={18} />, titulo: detalhes.artigo.title, texto: `${copy.artigo.titulo} · ${artigosCopy.minutos(detalhes.artigo.reading_minutes)}` }
          : { href: "/artigos", icone: <BookOpen size={18} />, titulo: copy.artigo.titulo, texto: copy.artigo.feito };
      case "faq":
        return { href: "/faq", icone: <Apple size={18} />, titulo: copy.faq.titulo, texto: copy.faq.texto };
      case "direitos":
        return detalhes.direitos ? { href: `/artigos/ler?slug=${detalhes.direitos.slug}&de=home`, icone: <Scale size={18} />, titulo: copy.direitos.titulo, texto: copy.direitos.texto[tri] } : null;
      default:
        return null;
    }
  };

  const tocar = (card: CardHome, posicao: number) => track("home_card_tapped", { card, position: posicao });

  return (
    <div className="flex flex-col gap-3" data-trimestre-home={tri}>
      {cards.map((c, i) => {
        const posicao = i + 1;
        if (c.card === "resumo")
          return (
            <div key="resumo" className="mb-3" onClickCapture={() => tocar("resumo", posicao)}>
              <AnelSemana g={g} />
            </div>
          );
        if (c.card === "consulta")
          return (
            <div key="consulta" className="py-1" onClickCapture={() => tocar("consulta", posicao)}>
              <CardConsulta />
            </div>
          );
        const a = atalho(c);
        return a ? <CardAtalho key={c.card} a={a} feito={c.estado === "feito"} onToque={() => tocar(c.card, posicao)} /> : null;
      })}
    </div>
  );
}
