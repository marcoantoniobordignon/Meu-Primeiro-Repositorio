import { Bookmark } from "lucide-react";
import Link from "next/link";

type Cor = "primaria" | "acento" | "banho" | "fralda" | "sono" | "mamada";

interface Props {
  href: string;
  titulo: string;
  meta: string;
  cor: Cor;
  lida?: boolean;
  guardada?: boolean;
}

const fundo: Record<Cor, string> = {
  primaria: "bg-primaria/12",
  acento: "bg-acento/12",
  banho: "bg-banho/14",
  fralda: "bg-fralda/16",
  sono: "bg-sono/12",
  mamada: "bg-mamada/12",
};

const circulo: Record<Cor, string> = {
  primaria: "bg-primaria",
  acento: "bg-acento",
  banho: "bg-banho",
  fralda: "bg-fralda",
  sono: "bg-sono",
  mamada: "bg-mamada",
};

/** Story: 118 × 118, raio 18, fundo suave da categoria, círculo da cor no canto. Lida: opacidade .6. */
export function Story({ href, titulo, meta, cor, lida = false, guardada = false }: Props) {
  return (
    <Link
      href={href}
      className={`relative flex size-[118px] shrink-0 flex-col justify-end rounded-card p-3 transition-transform active:scale-[0.97] ${fundo[cor]} ${lida ? "opacity-60" : ""}`}
    >
      <span aria-hidden className={`absolute left-3 top-3 size-3 rounded-full ${circulo[cor]}`} />
      {guardada && <Bookmark aria-hidden size={14} className="absolute right-3 top-2.5 text-texto-mudo" fill="currentColor" />}
      <span className="line-clamp-3 text-[11.5px] font-medium leading-[1.25] text-texto">{titulo}</span>
      <span className="tipo-meta mt-1 text-[10px]">{meta}</span>
    </Link>
  );
}
