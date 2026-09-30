interface Props {
  atual: number;
  total: number;
  rotulo: string;
}

/** Barra de progresso fina do onboarding: um segmento por tela. */
export function Progresso({ atual, total, rotulo }: Props) {
  return (
    <div
      role="progressbar"
      aria-label={rotulo}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={atual}
      className="flex gap-1.5"
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={`h-1 flex-1 rounded-pilula transition-colors duration-300 ${i < atual ? "bg-primaria" : "bg-fio"}`}
        />
      ))}
    </div>
  );
}
