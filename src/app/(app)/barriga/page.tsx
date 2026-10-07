"use client";

import { Camera, Clapperboard, Images, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { ConfirmarFoto } from "@/components/features/barriga/ConfirmarFoto";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Foto } from "@/components/ui/Foto";
import { Interruptor } from "@/components/ui/Interruptor";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/components/ui/Toast";
import { Vazio } from "@/components/ui/Vazio";
import { barrigaCopy as copy } from "@/copy/barriga";
import { manterFotos, retomarLembretes } from "@/lib/barriga/acoes";
import { gradeDeSemanas, MIN_FOTOS_TIMELAPSE, mostrarRetomar, timelapseDisponivel } from "@/lib/barriga/regras";
import { dataDaFoto, useBarriga } from "@/lib/barriga/useBarriga";
import { useColecao } from "@/lib/dados/colecao";
import { bellyPhotos } from "@/lib/dados/colecoes";
import { useFamilia } from "@/lib/familia/useFamilia";
import { useAberturaPorLembrete } from "@/lib/lembretes/abertura";
import { processarFoto, type FotoProcessada } from "@/lib/midia/imagem";
import { atualizarPerfil } from "@/lib/perfil";

function Abertura() {
  useAberturaPorLembrete();
  return null;
}

/** Tela 1 "Barriga": grade de semanas 4 a 42, a atual destacada; semanas puladas vazias com "+" (RN-02). */
export default function PaginaBarriga() {
  const fotos = useColecao(bellyPhotos);
  const { perfil, tz, hoje, semanaAtual, dum, prefs } = useBarriga();
  const { permissoes } = useFamilia();
  const router = useRouter();
  const { mostrar } = useToast();
  const galeria = useRef<HTMLInputElement>(null);
  const [escolhendo, setEscolhendo] = useState<number | null>(null);
  const [daGaleria, setDaGaleria] = useState<{ semana: number; foto: FotoProcessada; arquivo: File } | null>(null);
  const semanaGaleria = useRef<number | null>(null);
  const [retomarDispensado, setRetomarDispensado] = useState(false);

  useEffect(() => manterFotos(), [fotos.length]);

  if (!perfil) return null;
  const podeTirar = permissoes.tirarFotosBarriga;
  const grade = gradeDeSemanas(fotos, semanaAtual);
  const vivas = fotos.length;
  const atualSemFoto = semanaAtual !== null && !fotos.some((f) => f.gest_week === semanaAtual);

  async function aoEscolherDaGaleria(arquivo: File | undefined) {
    const semana = semanaGaleria.current;
    if (!arquivo || semana === null) return;
    try {
      setDaGaleria({ semana, foto: await processarFoto(arquivo, { proporcao: 3 / 4 }), arquivo });
    } catch {
      mostrar(copy.erroFoto);
    } finally {
      if (galeria.current) galeria.current.value = "";
    }
  }

  if (daGaleria) {
    return (
      <div className="fixed inset-0 z-40 mx-auto max-w-md overflow-y-auto bg-fundo">
        <ConfirmarFoto
          foto={daGaleria.foto}
          semana={daGaleria.semana}
          origem="gallery"
          takenOn={dataDaFoto(hoje, dum, tz, daGaleria.arquivo)}
          onRefazer={() => setDaGaleria(null)}
          onConcluido={() => setDaGaleria(null)}
        />
      </div>
    );
  }

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" />
      <Suspense>
        <Abertura />
      </Suspense>
      <input ref={galeria} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" aria-label={copy.galeria} onChange={(e) => void aoEscolherDaGaleria(e.target.files?.[0])} />

      <div className="flex flex-col gap-5 px-5 pt-1">
        {semanaAtual === null ? (
          <Vazio icone={<Camera size={24} />} frase={copy.antesDaSemana4} />
        ) : (
          <>
            {podeTirar && !retomarDispensado && mostrarRetomar(semanaAtual, fotos, perfil.prefs) && (
              <Card tom="acento">
                <p className="tipo-saudacao text-texto">{copy.retomarTitulo}</p>
                <p className="tipo-corpo mt-1 text-texto-mudo">{copy.retomarApoio}</p>
                <div className="mt-3 flex gap-2">
                  <Botao
                    largura="total"
                    onClick={() => {
                      retomarLembretes(perfil, semanaAtual);
                      mostrar(copy.retomado);
                    }}
                  >
                    {copy.retomar}
                  </Botao>
                  <Botao largura="total" variant="fantasma" onClick={() => setRetomarDispensado(true)}>
                    {copy.dispensar}
                  </Botao>
                </div>
              </Card>
            )}

            {podeTirar && atualSemFoto && (
              <Card tom="suave">
                <p className="tipo-saudacao text-texto">{copy.vazio(semanaAtual)}</p>
                {vivas === 0 && <p className="tipo-corpo mt-1 text-texto-mudo">{copy.vazioApoio}</p>}
                <div className="mt-3">
                  <Botao largura="total" icone={<Camera size={18} aria-hidden />} onClick={() => router.push(`/barriga/camera?semana=${semanaAtual}`)}>
                    {copy.tirarFoto}
                  </Botao>
                </div>
              </Card>
            )}

            {timelapseDisponivel(fotos) ? (
              <Link href="/barriga/timelapse" className="flex min-h-12 items-center gap-3 rounded-card bg-superficie px-4 text-[15px] font-medium text-texto [[data-tema=escuro]_&]:border [[data-tema=escuro]_&]:border-fio">
                <Clapperboard size={18} aria-hidden className="text-primaria-texto" />
                {copy.timelapse}
              </Link>
            ) : (
              vivas > 0 && <p className="tipo-meta">{copy.timelapseFalta(MIN_FOTOS_TIMELAPSE - vivas)}</p>
            )}

            <ul className="grid grid-cols-4 gap-2" aria-label={copy.titulo}>
              {grade.map((s) => {
                const rotulo = s.foto ? copy.verSemana(s.semana) : s.estado === "futura" ? copy.semanaFutura(s.semana) : copy.adicionarSemana(s.semana);
                const borda = s.estado === "atual" ? "border-2 border-acento" : "border border-fio";
                const conteudo = s.foto ? (
                  <Foto caminho={s.foto.storage_path} alt={copy.semana(s.semana)} />
                ) : s.estado !== "futura" && podeTirar ? (
                  <Plus size={18} aria-hidden className="text-primaria-texto" />
                ) : null;
                return (
                  <li key={s.semana}>
                    <button
                      type="button"
                      aria-label={rotulo}
                      disabled={s.estado === "futura" || (!s.foto && !podeTirar)}
                      onClick={() => (s.foto ? router.push(`/barriga/${s.semana}`) : setEscolhendo(s.semana))}
                      className={`relative grid aspect-[3/4] w-full place-items-center overflow-hidden rounded-[12px] bg-superficie ${borda} disabled:opacity-45`}
                    >
                      {conteudo}
                      <span className={`absolute left-1 top-1 rounded-pilula px-1.5 text-[11px] font-medium ${s.foto ? "bg-texto/55 text-superficie" : "text-texto-mudo"}`}>{s.semana}</span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {podeTirar && (
              <Card compacto>
                <Interruptor rotulo={copy.lembretes} apoio={copy.lembretesApoio} ligado={prefs.belly_reminders} onMudar={(v) => atualizarPerfil({ prefs: { ...perfil.prefs, belly_reminders: v } })} />
              </Card>
            )}
          </>
        )}
      </div>

      <Sheet aberto={escolhendo !== null} onFechar={() => setEscolhendo(null)} titulo={escolhendo !== null ? copy.comoAdicionar(escolhendo) : undefined}>
        <div className="flex flex-col gap-2 pb-2">
          <Botao largura="total" tamanho="lg" icone={<Camera size={18} aria-hidden />} onClick={() => router.push(`/barriga/camera?semana=${escolhendo}`)}>
            {copy.camera}
          </Botao>
          <Botao
            largura="total"
            variant="secundario"
            icone={<Images size={18} aria-hidden />}
            onClick={() => {
              semanaGaleria.current = escolhendo;
              setEscolhendo(null);
              galeria.current?.click();
            }}
          >
            {copy.galeria}
          </Botao>
        </div>
      </Sheet>
    </div>
  );
}
