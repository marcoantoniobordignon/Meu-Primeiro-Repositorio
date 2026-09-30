"use client";

import { Baby, House, Plus, ShoppingBag, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { nav as copy } from "@/copy/nav";

const abas = [
  { href: "/hoje", rotulo: copy.hoje, Icone: House },
  { href: "/bebe", rotulo: copy.bebe, Icone: Baby },
  { href: "/enxoval", rotulo: copy.enxoval, Icone: ShoppingBag },
  { href: "/eu", rotulo: copy.eu, Icone: UserRound },
] as const;

/** 4 abas e o "+" central elevado; a única sombra do app (spec 02). */
export function TabBar() {
  const caminho = usePathname();
  const [esq, dir] = [abas.slice(0, 2), abas.slice(2)];

  const aba = ({ href, rotulo, Icone }: (typeof abas)[number]) => {
    const ativa = caminho === href || caminho.startsWith(`${href}/`);
    return (
      <Link
        key={href}
        href={href}
        aria-current={ativa ? "page" : undefined}
        className={`flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
          ativa ? "text-primaria-texto" : "text-texto-mudo"
        }`}
      >
        <Icone size={22} strokeWidth={ativa ? 2.4 : 1.8} fill={ativa ? "currentColor" : "none"} fillOpacity={ativa ? 0.18 : 0} />
        {rotulo}
      </Link>
    );
  };

  return (
    <nav
      aria-label={copy.navegacao}
      className="safe-bottom fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-fio bg-superficie"
    >
      <div className="relative flex h-14 items-stretch">
        {esq.map(aba)}
        <div className="w-16" />
        {dir.map(aba)}
        <Link
          href="/registrar"
          aria-label={copy.registrar}
          className="absolute left-1/2 top-0 grid size-[52px] -translate-x-1/2 -translate-y-[30px] place-items-center rounded-full bg-primaria text-white shadow-mais active:scale-95"
        >
          <Plus size={26} strokeWidth={2.4} />
        </Link>
      </div>
    </nav>
  );
}
