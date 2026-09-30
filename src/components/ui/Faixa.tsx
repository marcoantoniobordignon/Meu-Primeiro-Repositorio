import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  tom?: "info" | "alerta";
  icone?: ReactNode;
}

/** Faixa: aviso persistente fino no topo do conteúdo (sem rede, trial acabando). */
export function Faixa({ children, tom = "info", icone }: Props) {
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-pilula px-3.5 py-2 text-[12px] ${
        tom === "info" ? "bg-primaria-suave text-primaria-texto" : "bg-acento-suave text-texto"
      }`}
    >
      {icone}
      <span>{children}</span>
    </div>
  );
}
