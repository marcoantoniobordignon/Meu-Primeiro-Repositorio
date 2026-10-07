import type { Metadata } from "next";

/** Funcionalidade 14 RN-06: a leitura pública não entra em busca nem é seguida por robôs. */
export const metadata: Metadata = {
  title: "Uma carta para você",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default function LayoutCarta({ children }: { children: React.ReactNode }) {
  return children;
}
