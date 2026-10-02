/**
 * Níveis de qualidade adaptativos: a cena roda em três patamares e desce um
 * degrau quando o drei PerformanceMonitor acusa queda. Em "baixo", nada de pós.
 */
export type Nivel = "alto" | "medio" | "baixo";

export interface Qualidade {
  nivel: Nivel;
  dpr: number;
  particulas: number;
  pos: boolean;
  godRays: boolean;
  profundidadeDeCampo: boolean;
  resolucaoMarchingCubes: number;
}

export const niveis: Record<Nivel, Qualidade> = {
  alto: { nivel: "alto", dpr: 2, particulas: 1400, pos: true, godRays: true, profundidadeDeCampo: true, resolucaoMarchingCubes: 96 },
  medio: { nivel: "medio", dpr: 1.5, particulas: 800, pos: true, godRays: false, profundidadeDeCampo: true, resolucaoMarchingCubes: 80 },
  baixo: { nivel: "baixo", dpr: 1, particulas: 300, pos: false, godRays: false, profundidadeDeCampo: false, resolucaoMarchingCubes: 64 },
};

export function descer(nivel: Nivel): Nivel {
  return nivel === "alto" ? "medio" : "baixo";
}

export function subir(nivel: Nivel): Nivel {
  return nivel === "baixo" ? "medio" : "alto";
}

/**
 * Chute inicial pela GPU e pela máquina. Depois o monitor ajusta ao vivo.
 * Apple GPU, Adreno 6xx/7xx e Mali-G7x+ começam em alto; Mali-G5x e
 * desconhecidos em médio; renderização por software (SwiftShader) em baixo.
 */
export function nivelInicial(renderer: string, nucleos = 4, memoriaGb = 4): Nivel {
  const r = renderer.toLowerCase();
  if (r.includes("swiftshader") || r.includes("llvmpipe") || r.includes("software")) return "baixo";
  if (r.includes("apple")) return "alto";
  const adreno = r.match(/adreno[^0-9]*(\d{3})/);
  if (adreno) return Number(adreno[1]) >= 610 ? "alto" : "medio";
  const mali = r.match(/mali-g(\d{2,3})/);
  if (mali) return Number(mali[1]) >= 68 ? "alto" : "medio";
  if (r.includes("nvidia") || r.includes("radeon") || r.includes("geforce") || r.includes("intel")) return "alto";
  if (nucleos >= 8 && memoriaGb >= 6) return "alto";
  return "medio";
}

export function lerRenderer(gl: WebGLRenderingContext | WebGL2RenderingContext): string {
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  return ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
}

export function prefereReduzirMovimento(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
