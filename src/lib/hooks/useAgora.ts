"use client";

import { useEffect, useState } from "react";

/** Relógio que re-renderiza a cada `ms`. Para contadores "há X" e timers. */
export function useAgora(ms = 1000): Date {
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setAgora(new Date()), ms);
    return () => window.clearInterval(t);
  }, [ms]);
  return agora;
}
