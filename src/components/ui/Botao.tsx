"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variante = "primario" | "secundario" | "fantasma";
type Tamanho = "md" | "lg";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> {
  variant?: Variante;
  tamanho?: Tamanho;
  carregando?: boolean;
  icone?: ReactNode;
  largura?: "auto" | "total";
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-pilula font-medium select-none " +
  "transition-[filter,opacity,transform] duration-150 active:scale-[0.98] " +
  "disabled:opacity-45 disabled:pointer-events-none";

const variantes: Record<Variante, string> = {
  primario: "bg-primaria text-white active:brightness-92",
  secundario: "bg-primaria-suave text-primaria-texto active:brightness-92",
  fantasma: "bg-transparent text-primaria-texto active:bg-primaria-suave",
};

const tamanhos: Record<Tamanho, string> = {
  md: "min-h-11 px-5 text-[14px]",
  lg: "min-h-13 px-6 text-[16px]",
};

/** Botão do design system (spec 02). Um primário por tela. DS-01: sem className. */
export function Botao({
  variant = "primario",
  tamanho = "md",
  carregando = false,
  icone,
  largura = "auto",
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className={`${base} ${variantes[variant]} ${tamanhos[tamanho]} ${largura === "total" ? "w-full" : ""}`}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...rest}
    >
      {carregando ? (
        <span
          aria-hidden
          className="size-4 rounded-full border-2 border-current border-t-transparent anim-girar"
        />
      ) : (
        icone
      )}
      <span>{children}</span>
    </button>
  );
}
