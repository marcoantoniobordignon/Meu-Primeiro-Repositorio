import type { HTMLAttributes, ReactNode } from "react";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "className"> {
  children: ReactNode;
  /** 'suave' usa o fundo primário suave (para destaques). */
  tom?: "superficie" | "suave" | "acento";
  compacto?: boolean;
}

const tons = {
  superficie: "bg-superficie border border-transparent [[data-tema=escuro]_&]:border-fio",
  suave: "bg-primaria-suave",
  acento: "bg-acento-suave",
};

/** Card: superfície, raio 18, padding 14/16, sem sombra. */
export function Card({ children, tom = "superficie", compacto = false, ...rest }: Props) {
  return (
    <div className={`rounded-card ${tons[tom]} ${compacto ? "px-4 py-3" : "px-4 py-3.5"}`} {...rest}>
      {children}
    </div>
  );
}
