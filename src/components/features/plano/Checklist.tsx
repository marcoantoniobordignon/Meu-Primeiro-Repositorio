"use client";

import { Camera, Check, Minus, Plus, Trash2, X } from "lucide-react";
import { useRef, useState } from "react";

import { SheetPaywall } from "@/components/features/paywall/SheetPaywall";
import { Botao } from "@/components/ui/Botao";
import { CampoTexto } from "@/components/ui/CampoTexto";
import { Foto } from "@/components/ui/Foto";
import { useToast } from "@/components/ui/Toast";
import { planoCopy as copy } from "@/copy/planoParto";
import { track } from "@/lib/analytics";
import type { BirthChecklistItem, BirthItemAttachment } from "@/lib/dados/colecoes";
import { adicionarItem, alternarItem, anexarFoto, mudarQuantidade, removerAnexo, removerItem } from "@/lib/plano/acoes";
import { temPlano, type Perfil } from "@/lib/perfil";
import { itensDaLista, podeAnexar, progressoDaLista, type Lista } from "@dominio/plano-parto.ts";

interface Props {
  lista: Lista;
  itens: BirthChecklistItem[];
  anexos: BirthItemAttachment[];
  autor: string;
  papel: string;
  perfil: Perfil;
  /** Documentos: foto de cada item (RN-09). Malas e enxoval: quantidade. */
  comAnexos?: boolean;
}

/** RN-06/10: marcar, adicionar, quantidade e remover; o parceiro com `birth_plan` também marca e adiciona. */
export function Checklist({ lista, itens, anexos, autor, papel, perfil, comAnexos = false }: Props) {
  const daLista = itensDaLista(itens, lista);
  const { feitos, total } = progressoDaLista(itens, lista);
  const [novo, setNovo] = useState("");
  const [paywall, setPaywall] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);
  const alvo = useRef<BirthChecklistItem | null>(null);
  const { mostrar } = useToast();
  const nome = copy.listas[lista];
  const ehMae = papel === "mae";

  function alternar(i: BirthChecklistItem) {
    alternarItem(i);
    track("bp_checklist_toggled", { list: lista });
    if (papel === "parceiro") track("partner_checklist_toggled", {});
  }

  function pedirFoto(i: BirthChecklistItem) {
    const noItem = anexos.filter((a) => a.item_id === i.id).length;
    const r = podeAnexar(noItem, anexos.length, temPlano(perfil));
    if (r === "item_cheio") return mostrar(copy.itemCheio);
    if (r === "limite_free") return setPaywall(true);
    alvo.current = i;
    entrada.current?.click();
  }

  return (
    <section aria-labelledby={`lista-${lista}`} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id={`lista-${lista}`} className="text-[17px] font-medium text-texto">
          {nome}
        </h2>
        <span className="tipo-meta" aria-label={`${nome}: ${copy.progressoLista(feitos, total)}`}>
          {copy.progressoLista(feitos, total)}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-pilula bg-fio" aria-hidden>
        <div className="h-full rounded-pilula bg-primaria transition-[width]" style={{ width: `${total ? (feitos / total) * 100 : 0}%` }} />
      </div>
      {comAnexos && (
        <input
          ref={entrada}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            const item = alvo.current;
            e.target.value = "";
            if (!f || !item) return;
            try {
              await anexarFoto(item, f, autor);
            } catch {
              mostrar(copy.anexoErro);
            }
          }}
        />
      )}
      <ul className="flex flex-col divide-y divide-fio">
        {daLista.map((i) => {
          const fotos = anexos.filter((a) => a.item_id === i.id).sort((a, b) => a.position - b.position);
          return (
            <li key={i.id} className="flex flex-col gap-1 py-1">
              <div className="flex items-center gap-1">
                <button type="button" role="checkbox" aria-checked={i.is_done} aria-label={copy.marcar(i.title)} onClick={() => alternar(i)} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left">
                  <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-[6px] border ${i.is_done ? "border-primaria bg-primaria text-superficie" : "border-fio"}`}>
                    {i.is_done && <Check size={16} />}
                  </span>
                  <span className={`text-[15px] ${i.is_done ? "text-texto-mudo line-through" : "text-texto"}`}>{i.title}</span>
                </button>
                {!comAnexos && (
                  <span className="flex items-center" aria-label={copy.quantidade(i.title)}>
                    <button type="button" aria-label={copy.menos(i.title)} onClick={() => mudarQuantidade(i, -1)} className="grid size-11 place-items-center text-texto-mudo">
                      <Minus size={16} />
                    </button>
                    <span className="w-5 text-center text-[14px] text-texto">{i.quantity ?? 1}</span>
                    <button type="button" aria-label={copy.mais(i.title)} onClick={() => mudarQuantidade(i, 1)} className="grid size-11 place-items-center text-texto-mudo">
                      <Plus size={16} />
                    </button>
                  </span>
                )}
                {comAnexos && ehMae && (
                  <button type="button" aria-label={copy.anexar(i.title)} onClick={() => pedirFoto(i)} className="grid size-11 place-items-center text-primaria-texto">
                    <Camera size={18} />
                  </button>
                )}
                {(ehMae || i.is_custom) && (
                  <button type="button" aria-label={copy.remover(i.title)} onClick={() => void removerItem(i)} className="grid size-11 place-items-center text-texto-mudo">
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {fotos.length > 0 && (
                <div className="ml-9 flex gap-2 pb-1">
                  {fotos.map((a) => (
                    <span key={a.id} className="relative size-16 overflow-hidden rounded-[10px] bg-fio">
                      <Foto caminho={a.storage_path} alt={copy.anexo(i.title, a.position)} />
                      {ehMae && (
                        <button type="button" aria-label={copy.removerAnexo(a.position)} onClick={() => void removerAnexo(a.id)} className="absolute right-0 top-0 grid size-11 place-items-start justify-end p-1 text-superficie">
                          <span className="grid size-5 place-items-center rounded-full bg-texto/60">
                            <X size={12} />
                          </span>
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (adicionarItem(lista, novo, autor)) {
            track("bp_item_added", { list: lista });
            setNovo("");
            mostrar(copy.itemAdicionado);
          }
        }}
      >
        <div className="flex-1">
          <CampoTexto rotulo={copy.novoItem(nome)} value={novo} maxLength={80} onChange={(e) => setNovo(e.target.value)} />
        </div>
        <Botao type="submit" variant="secundario" disabled={!novo.trim()} icone={<Plus size={16} aria-hidden />}>
          {copy.adicionarItem}
        </Botao>
      </form>
      <SheetPaywall aberto={paywall} gatilho={{ feature: "birth_plan", trigger: "attachments_limit" }} onFechar={() => setPaywall(false)} />
    </section>
  );
}
