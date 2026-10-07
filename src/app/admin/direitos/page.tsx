"use client";

import { useEffect, useState } from "react";

import { Card } from "@/components/ui/Card";
import { adminCopy } from "@/copy/admin";
import { formatarLonga } from "@/lib/dates";
import { cartoesParaRevisar, type CartaoVencido } from "@/lib/direitos/admin";

const copy = adminCopy.direitos;

/** Funcionalidade 16 RN-02: o alerta do revisor (cartões com revisão de mais de 12 meses). */
export default function PaginaAdminDireitos() {
  const [lista, setLista] = useState<CartaoVencido[] | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    cartoesParaRevisar()
      .then(setLista)
      .catch(() => setErro(true));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="tipo-saudacao text-texto">{copy.titulo}</h1>
      <p className="tipo-corpo text-texto-mudo">{copy.apoio}</p>
      {erro ? (
        <Card>
          <p className="tipo-corpo text-erro" role="alert">
            {copy.erro}
          </p>
        </Card>
      ) : lista === null ? (
        <p className="tipo-meta" aria-busy="true">
          {copy.carregando}
        </p>
      ) : lista.length === 0 ? (
        <Card>
          <p className="tipo-corpo text-texto-mudo">{copy.vazio}</p>
        </Card>
      ) : (
        <ul className="divide-y divide-fio rounded-card bg-superficie px-4">
          {lista.map((c) => (
            <li key={c.slug} className="py-3">
              <p className="text-[15px] font-medium text-texto">{c.question}</p>
              <p className="tipo-meta">{copy.revisadoEm(formatarLonga(c.reviewed_on))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
