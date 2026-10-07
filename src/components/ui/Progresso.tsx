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

/** Barra contínua (downloads, gravação): 0 a 1, com o texto do andamento para leitor de tela. */
export function ProgressoContinuo({ fracao, rotulo }: { fracao: number; rotulo: string }) {
  const p = Math.max(0, Math.min(1, fracao));
  return (
    <div role="progressbar" aria-label={rotulo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p * 100)} className="h-1.5 w-full overflow-hidden rounded-pilula bg-fio">
      <span className="block h-full origin-left rounded-pilula bg-primaria transition-transform duration-300 ease-out" style={{ transform: `scaleX(${p})` }} />
    </div>
  );
}
