"use client";

import { CircleAlert, CircleCheck } from "lucide-react";

import { Painel } from "@/components/admin/Painel";
import { Titulo } from "@/components/admin/Titulo";
import { adminCopy as copy } from "@/copy/admin";
import { useDados } from "@/lib/admin/fonte";
import { useSessaoAdmin } from "@/lib/admin/sessao";
import { bancoBruto } from "@/lib/conteudo/banco";
import { supabaseConfigurado } from "@/lib/supabase/client";

const s = copy.sistema;

export default function PaginaSistema() {
  const sessao = useSessaoAdmin();
  const conteudos = useDados((f) => f.conteudos());
  const supabase = supabaseConfigurado();
  const ga = Boolean(process.env.NEXT_PUBLIC_GA_ID);

  return (
    <div>
      <Titulo titulo={s.titulo} apoio={s.apoio} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Serviços">
          <ul className="flex flex-col divide-y divide-fio">
            <Linha ok={supabase} titulo={s.supabase} apoio={supabase ? s.supabaseOk : s.supabaseOff} />
            <Linha ok={supabase} titulo={s.edge} apoio={supabase ? s.edgeOk : s.edgeOff} />
            <Linha ok={ga} titulo={s.analytics} apoio={ga ? s.analyticsOk : s.analyticsOff} />
            <Linha
              ok
              titulo={s.banco}
              apoio={`${s.bancoBundle(bancoBruto.length)}${conteudos.dados && supabase ? ` · ${s.bancoServidor(conteudos.dados.length)}` : ""}`}
              extra={s.bancoAjuda}
            />
            {sessao.estado === "admin" && <Linha ok titulo={s.admin} apoio={s.adminApoio(sessao.email)} />}
          </ul>
        </Painel>
        <Painel titulo={s.passos}>
          <ol className="flex flex-col gap-3">
            {s.passosLista.map((p, i) => (
              <li key={p} className="flex gap-3 text-[13px] leading-[1.45] text-texto">
                <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-full bg-primaria-suave text-[12px] font-medium text-primaria-texto">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
        </Painel>
      </div>
    </div>
  );
}

function Linha({ ok, titulo, apoio, extra }: { ok: boolean; titulo: string; apoio: string; extra?: string }) {
  return (
    <li className="flex gap-3 py-3 first:pt-0 last:pb-0">
      <span aria-hidden className={`mt-0.5 shrink-0 ${ok ? "text-sucesso" : "text-texto-mudo"}`}>{ok ? <CircleCheck size={18} /> : <CircleAlert size={18} />}</span>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-texto">{titulo}</p>
        <p className="tipo-corpo text-texto-mudo">{apoio}</p>
        {extra && <p className="tipo-meta mt-1">{extra}</p>}
      </div>
    </li>
  );
}
