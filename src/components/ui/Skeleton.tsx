interface Props {
  largura?: number | string;
  altura?: number | string;
  redondo?: boolean;
}

/** Skeleton: bloco neutro pulsando de leve, para conteúdo ainda não carregado. */
export function Skeleton({ largura = "100%", altura = 16, redondo = false }: Props) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse bg-fio ${redondo ? "rounded-full" : "rounded-card"}`}
      style={{ width: largura, height: altura }}
    />
  );
}
