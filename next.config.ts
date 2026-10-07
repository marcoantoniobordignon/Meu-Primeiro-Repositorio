import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Em desenvolvimento o SW atrapalha o HMR; entra só no build.
  disable: process.env.NODE_ENV === "development",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
  // Voltar a rede não recarrega a tela (perderia o que está sendo escrito); a fila sincroniza sozinha (sync.ts).
  reloadOnOnline: false,
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Funcionalidade 08 RN-08: o feed iCal mora em {APP_URL}/ics/{token}.ics e é servido pela Edge Function.
  async rewrites() {
    return supabaseUrl ? [{ source: "/ics/:arquivo", destination: `${supabaseUrl}/functions/v1/calendario-ics?arquivo=:arquivo` }] : [];
  },
};

export default withSerwist(nextConfig);
