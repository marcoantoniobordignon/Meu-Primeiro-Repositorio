import { Botao } from "@/components/ui/Botao";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminCopy as copy } from "@/copy/admin";

/** Erro de carregamento: uma frase e o botão de tentar de novo. */
export function Erro({ mensagem, onTentar }: { mensagem?: string; onTentar: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-card bg-acento-suave px-4 py-3.5">
      <p className="tipo-corpo text-texto">{copy.estados.erro}</p>
      {mensagem && <p className="tipo-meta break-all">{mensagem}</p>}
      <Botao variant="secundario" onClick={onTentar}>
        {copy.estados.tentar}
      </Botao>
    </div>
  );
}

/** Esqueleto de gráfico: barras pulsando na altura do gráfico real. */
export function EsqueletoGrafico({ altura = 180 }: { altura?: number }) {
  return (
    <div className="flex items-end gap-2" style={{ height: altura }} aria-busy="true">
      {[40, 65, 50, 80, 60, 90, 70, 55, 75, 85, 60, 95].map((h, i) => (
        <div key={i} className="flex-1">
          <Skeleton altura={`${h}%`} />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoLinhas({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3 py-1" aria-busy="true">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} altura={14} largura={`${60 + ((i * 17) % 40)}%`} />
      ))}
    </div>
  );
}
