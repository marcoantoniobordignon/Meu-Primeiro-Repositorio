"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

import { track } from "@/lib/analytics";

function Leitor() {
  const params = useSearchParams();
  const semana = Number(params.get("semana"));
  const doLembrete = params.get("origem") === "lembrete" && params.get("categoria") === "birth_plan";
  useEffect(() => {
    if (doLembrete && semana) track("bp_reminder_opened", { week: semana });
  }, [doLembrete, semana]);
  return null;
}

/** RN-07: `bp_reminder_opened {week}` quando ela chega pelo lembrete. */
export function AberturaPorLembrete() {
  return (
    <Suspense>
      <Leitor />
    </Suspense>
  );
}
