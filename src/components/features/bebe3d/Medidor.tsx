"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

import { useCena } from "./contexto";

/** Dentro do Canvas: mede fps e escreve no estado compartilhado (a UI lê a 2 Hz). */
export function MedidorFps() {
  const cena = useCena();
  const quadros = useRef(0);
  const acumulado = useRef(0);
  useFrame((_, dt) => {
    quadros.current++;
    acumulado.current += dt;
    if (acumulado.current >= 0.5) {
      cena.fps = Math.round(quadros.current / acumulado.current);
      quadros.current = 0;
      acumulado.current = 0;
    }
  });
  return null;
}
