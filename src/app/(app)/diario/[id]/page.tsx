"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { metaDaEntrada } from "@/components/features/diario/LinhaEntrada";
import { Audio } from "@/components/ui/Audio";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Card } from "@/components/ui/Card";
import { Foto } from "@/components/ui/Foto";
import { Interruptor } from "@/components/ui/Interruptor";
import { SheetConfirmar } from "@/components/ui/SheetConfirmar";
import { useToast } from "@/components/ui/Toast";
import { diarioCopy as copy } from "@/copy/diario";
import { track } from "@/lib/analytics";
import { useColecao } from "@/lib/dados/colecao";
import { diaryPhotos } from "@/lib/dados/colecoes";
import { alternarCompartilhamento, excluirEntrada } from "@/lib/diario/acoes";
import { podeEditar, visivelPara } from "@/lib/diario/regras";
import { useDiario } from "@/lib/diario/useDiario";
import { marcoDoCatalogo, perguntaDoMarco } from "@dominio/diario.ts";

/** Tela 4 "Entrada": leitura, editar, excluir (RN-08) e "Compartilhar com meu parceiro" (RN-09). */
export default function PaginaEntrada() {
  const { id } = useParams<{ id: string }>();
  const { entradas, eu, papel, membros, perfil, hoje, modoFe } = useDiario();
  const fotos = useColecao(diaryPhotos);
  const router = useRouter();
  const { mostrar } = useToast();
  const [excluindo, setExcluindo] = useState(false);
  const e = entradas.find((x) => x.id === id);

  if (!e || !visivelPara(e, eu, papel)) return <Cabecalho titulo={copy.titulo} voltarPara="/diario" />;
  const entrada = e;
  const marco = marcoDoCatalogo(entrada.milestone_code);
  const minhas = podeEditar(entrada, eu);
  const daEntrada = fotos.filter((f) => f.entry_id === entrada.id).sort((a, b) => a.position - b.position);

  return (
    <div>
      <Cabecalho
        titulo={marco?.title ?? copy.titulo}
        voltarPara="/diario"
        acao={
          minhas ? (
            <button type="button" aria-label={copy.editarEntrada} onClick={() => router.push(`/diario/escrever?id=${entrada.id}`)} className="grid size-11 place-items-center rounded-pilula text-texto active:bg-primaria-suave">
              <Pencil size={18} />
            </button>
          ) : undefined
        }
      />
      <div className="flex flex-col gap-4 px-5 pt-1">
        <p className="tipo-meta">{metaDaEntrada(entrada, perfil?.dpp, hoje, eu, membros)}</p>
        {marco && <p className="tipo-corpo text-texto-mudo">{perguntaDoMarco(marco, modoFe)}</p>}
        {entrada.body && <p className="whitespace-pre-line text-[16px] leading-relaxed text-texto">{entrada.body}</p>}
        {entrada.audio_path && <Audio rotulo={copy.audio} caminho={entrada.audio_path} />}
        {daEntrada.length > 0 && (
          <div className="grid grid-cols-1 gap-2">
            {daEntrada.map((f) => (
              <div key={f.id} className="overflow-hidden rounded-card bg-fio">
                <Foto caminho={f.storage_path} alt={`${copy.fotosRotulo} ${f.position}`} ajuste="contain" />
              </div>
            ))}
          </div>
        )}

        {minhas && papel === "mae" && (
          <Card compacto>
            <Interruptor
              rotulo={copy.compartilhar}
              apoio={copy.compartilharApoio}
              ligado={entrada.shared_with_partner}
              onMudar={(v) => {
                alternarCompartilhamento(entrada, v);
                if (v) {
                  track("diary_entry_shared_partner", {});
                  mostrar(copy.compartilhado);
                }
              }}
            />
          </Card>
        )}

        {minhas && (
          <Botao variant="fantasma" icone={<Trash2 size={16} aria-hidden />} onClick={() => setExcluindo(true)}>
            {copy.excluir}
          </Botao>
        )}
      </div>
      <SheetConfirmar
        aberto={excluindo}
        titulo={copy.excluirTitulo}
        texto={copy.excluirTexto}
        confirmar={copy.excluir}
        cancelar={copy.cancelar}
        onFechar={() => setExcluindo(false)}
        onConfirmar={() => {
          void excluirEntrada(entrada);
          mostrar(copy.excluida);
          router.replace("/diario");
        }}
      />
    </div>
  );
}
