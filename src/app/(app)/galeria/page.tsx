"use client";

import { FileDown, FolderHeart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useState } from "react";

import { ItemDocumento } from "@/components/features/galeria/ItemDocumento";
import { Botao } from "@/components/ui/Botao";
import { Cabecalho } from "@/components/ui/Cabecalho";
import { Escolha } from "@/components/ui/Escolha";
import { Vazio } from "@/components/ui/Vazio";
import { galeriaCopy as copy } from "@/copy/galeria";
import { filtrar, ordenar, paginasDo, type Filtro } from "@/lib/galeria/regras";
import { useGaleria } from "@/lib/galeria/useGaleria";
import { TIPOS_DOCUMENTO } from "@dominio/galeria.ts";

const CHAVE_VISTA = "ninho.galeria.vista";
const CHAVE_ROLAGEM = "ninho.galeria.rolagem";

/** Tela 1 "Galeria": chips de tipo, grade ou linha do tempo, "+ Adicionar". Volta na posição em que parou. */
export default function PaginaGaleria() {
  const { docs, paginas, perfil, hoje, podeEditar } = useGaleria();
  const router = useRouter();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [vista, setVista] = useState<"grade" | "linha">("linha");

  useEffect(() => {
    try {
      const v = localStorage.getItem(CHAVE_VISTA);
      if (v === "grade" || v === "linha") setVista(v);
    } catch {
      /* nada */
    }
  }, []);

  // Critério de aceite: volta depois de meses "na posição em que parei".
  useLayoutEffect(() => {
    try {
      const y = Number(sessionStorage.getItem(CHAVE_ROLAGEM) ?? 0);
      if (y > 0) window.scrollTo(0, y);
    } catch {
      /* nada */
    }
    const guardar = () => {
      try {
        sessionStorage.setItem(CHAVE_ROLAGEM, String(window.scrollY));
      } catch {
        /* nada */
      }
    };
    window.addEventListener("pagehide", guardar);
    return () => {
      guardar();
      window.removeEventListener("pagehide", guardar);
    };
  }, []);

  if (!perfil) return null;
  const tiposComDoc = TIPOS_DOCUMENTO.filter((t) => docs.some((d) => d.kind === t));
  const lista = ordenar(filtrar(docs, filtro));
  const opcoes: { valor: Filtro; rotulo: string }[] = [
    { valor: "todos", rotulo: copy.filtros.todos },
    ...(tiposComDoc.filter((t) => t.startsWith("us_")).length > 1 ? [{ valor: "us" as const, rotulo: copy.filtros.us }] : []),
    ...tiposComDoc.map((t) => ({ valor: t, rotulo: copy.tipos[t] })),
  ];

  return (
    <div>
      <Cabecalho titulo={copy.titulo} voltarPara="/eu" acao={podeEditar ? <Botao variant="secundario" onClick={() => router.push("/galeria/adicionar")}>{copy.adicionar}</Botao> : undefined} />
      {docs.length === 0 ? (
        <Vazio icone={<FolderHeart size={24} />} frase={copy.vazio} acao={podeEditar ? <Botao onClick={() => router.push("/galeria/adicionar")}>{copy.vazioBotao}</Botao> : undefined} />
      ) : (
        <div className="flex flex-col gap-4 px-5 pt-1">
          <div className="scroll-x-sem-barra -mx-5 px-5">
            <Escolha semRotulo rotulo={copy.filtro} opcoes={opcoes} valor={filtro} onMudar={setFiltro} />
          </div>
          <Escolha
            semRotulo
            rotulo={copy.vista}
            opcoes={[
              { valor: "linha", rotulo: copy.linhaDoTempo },
              { valor: "grade", rotulo: copy.grade },
            ]}
            valor={vista}
            onMudar={(v) => {
              setVista(v);
              try {
                localStorage.setItem(CHAVE_VISTA, v);
              } catch {
                /* nada */
              }
            }}
          />
          <ul className={vista === "grade" ? "grid grid-cols-2 gap-3" : "flex flex-col gap-2"}>
            {lista.map((d) => (
              <ItemDocumento key={d.id} doc={d} paginas={paginasDo(d.id, paginas)} dpp={perfil.dpp} hoje={hoje} vista={vista} />
            ))}
          </ul>
          {podeEditar && (
            <Botao variant="fantasma" largura="total" icone={<FileDown size={16} aria-hidden />} onClick={() => router.push("/galeria/exportar")}>
              {copy.exportar}
            </Botao>
          )}
        </div>
      )}
    </div>
  );
}
