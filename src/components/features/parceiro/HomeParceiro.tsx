"use client";

import { BookHeart, CalendarDays, ChevronRight, ListChecks, MessageCircleQuestion } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Card } from "@/components/ui/Card";
import { parceiroCopy as copy } from "@/copy/parceiro";
import { track } from "@/lib/analytics";
import { conteudoDaSemana } from "@/lib/conteudo-semanas";
import { useColecao } from "@/lib/dados/colecao";
import { appointments, userExams } from "@/lib/dados/colecoes";
import { formatarLonga, formatarQuando } from "@/lib/dates";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useFuso } from "@/lib/hooks/useFuso";
import { dicaParaSemana } from "@/lib/parceiro/dicas";
import type { Perfil } from "@/lib/perfil";
import { proximosCompromissos, semanaDoParceiro } from "@dominio/parceiro.ts";

/** Tela 3 "Home do parceiro": semana e fruta, como ela pode estar, como ajudar, próximos compromissos e atalhos. */
export function HomeParceiro({ perfil }: { perfil: Perfil }) {
  const { permissoes } = useFamilia();
  const consultas = useColecao(appointments);
  const exames = useColecao(userExams);
  const tz = useFuso();
  const agora = new Date();
  const semana = semanaDoParceiro(perfil.dpp, agora, tz);
  const conteudo = semana !== null ? conteudoDaSemana(Math.max(1, semana)) : null;
  const dica = semana !== null ? dicaParaSemana(semana) : null;
  const compromissos = permissoes.verAgenda ? proximosCompromissos(consultas, exames.filter((e) => e.status === "scheduled"), agora, tz) : [];

  useEffect(() => track("partner_home_viewed", {}), []);
  useEffect(() => {
    if (dica && semana !== null) track("partner_tip_viewed", { week: semana });
  }, [dica, semana]);

  const atalho = (href: string, rotulo: string, Icone: typeof BookHeart) => (
    <Link href={href} className="flex min-h-13 items-center gap-3 px-4 text-[15px] text-texto">
      <Icone size={18} aria-hidden className="text-primaria-texto" />
      <span className="flex-1">{rotulo}</span>
      <ChevronRight size={18} aria-hidden className="text-texto-mudo" />
    </Link>
  );

  return (
    <div className="flex flex-col gap-4" data-testid="home-parceiro">
      {semana !== null && conteudo ? (
        <Card>
          <p className="tipo-heroi-rotulo text-primaria-texto">{copy.semanaTitulo(semana)}</p>
          <p className="mt-1 flex items-center gap-3 text-[17px] font-medium text-texto">
            <span aria-hidden className="text-[32px]">
              {conteudo.emoji}
            </span>
            {copy.tamanho(conteudo.tamanho)}
          </p>
          <p className="tipo-meta mt-2">{copy.dpp(formatarLonga(perfil.dpp!))}</p>
        </Card>
      ) : (
        <Card>
          <p className="tipo-corpo text-texto-mudo">{copy.semDpp}</p>
        </Card>
      )}

      {dica && (
        <>
          <section>
            <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.sentindoTitulo}</h2>
            <Card>
              <p className="tipo-corpo text-texto">{dica.feeling_text}</p>
            </Card>
          </section>
          <section>
            <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.ajudarTitulo}</h2>
            <Card>
              <ul className="flex flex-col gap-2">
                {dica.help_tips.map((t) => (
                  <li key={t} className="tipo-corpo flex gap-2 text-texto">
                    <span aria-hidden className="text-acento">
                      •
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      )}

      {permissoes.verAgenda && (
        <section>
          <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.compromissosTitulo}</h2>
          <Card compacto>
            {compromissos.length === 0 ? (
              <p className="tipo-corpo py-1 text-texto-mudo">{copy.semCompromissos}</p>
            ) : (
              <ul className="-mx-4 divide-y divide-fio">
                {compromissos.map((c) => (
                  <li key={`${c.tipo}-${c.id}`} className="flex min-h-13 items-center gap-3 px-4">
                    <CalendarDays size={18} aria-hidden className="shrink-0 text-primaria-texto" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium text-texto">{c.tipo === "consulta" ? `${copy.consulta} · ${c.titulo}` : c.titulo}</span>
                      <span className="tipo-meta block">{c.diaInteiro ? formatarLonga(c.quando.slice(0, 10)) : formatarQuando(c.quando)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      )}

      <section>
        <h2 className="tipo-titulo-secao mb-2 text-texto-mudo">{copy.atalhos}</h2>
        <Card compacto>
          <div className="-mx-4 divide-y divide-fio">
            {permissoes.verAgenda && atalho("/consultas/pauta", copy.pauta, MessageCircleQuestion)}
            {permissoes.verPlanoParto && atalho("/plano-parto", copy.listas, ListChecks)}
            {permissoes.verDiario && atalho("/diario", copy.diario, BookHeart)}
          </div>
        </Card>
      </section>
    </div>
  );
}
