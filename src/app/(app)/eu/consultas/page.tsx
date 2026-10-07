"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Rota antiga (spec 05): a agenda agora mora em /consultas. */
export default function RedirecionarConsultas() {
  const router = useRouter();
  useEffect(() => router.replace("/consultas"), [router]);
  return null;
}
