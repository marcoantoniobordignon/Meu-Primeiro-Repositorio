"use client";

import { useRouter } from "next/navigation";

import { Botao } from "@/components/ui/Botao";
import { nascimentoCopy as copy } from "@/copy/nascimento";
import { useBebes } from "@/lib/bebe/useBebes";

/** Tela de celebração única, sem confete: fundo teal, nome em itálica, "bem-vindo ao mundo". */
export default function PaginaBemVindo() {
  const router = useRouter();
  const { bebes } = useBebes();
  const nomes = bebes.map((b) => b.nome);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col bg-primaria px-6 text-white">
      <div className="flex flex-1 flex-col items-center justify-center text-center anim-surge">
        {nomes.map((n) => (
          <p key={n} className="font-serifa text-[56px] italic leading-[1.05] tracking-[-0.02em]">
            {n}
          </p>
        ))}
        <p className="tipo-saudacao mt-6 text-white/90">{nomes.length > 1 ? copy.bemVindo.fraseDois : copy.bemVindo.frase}</p>
      </div>
      <div className="safe-bottom pb-6">
        <button type="button" onClick={() => router.replace("/hoje")} className="min-h-13 w-full rounded-pilula bg-superficie text-[16px] font-medium text-primaria-texto active:brightness-95">
          {copy.bemVindo.cta}
        </button>
      </div>
      <span className="hidden">
        <Botao>{copy.bemVindo.cta}</Botao>
      </span>
    </div>
  );
}
