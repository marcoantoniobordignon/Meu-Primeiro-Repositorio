import type { Metadata, Viewport } from "next";
import { EB_Garamond, Outfit } from "next/font/google";

import { Analytics } from "@/components/ui/Analytics";
import { ProvedorTema } from "@/components/ui/ProvedorTema";
import { ProvedorToast } from "@/components/ui/Toast";
import { coresMeta } from "@/styles/cores-meta";
import "@/styles/globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
  variable: "--fonte-outfit",
});

const garamond = EB_Garamond({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["italic"],
  display: "swap",
  variable: "--fonte-garamond",
});

export const metadata: Metadata = {
  title: "Ninho",
  description: "Sua gestação e o primeiro ano do bebê, semana a semana.",
  applicationName: "Ninho",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icone.svg", apple: "/icons/icone.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Ninho" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: coresMeta.fundoClaro },
    { media: "(prefers-color-scheme: dark)", color: coresMeta.fundoEscuro },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" data-tema="auto" className={`${outfit.variable} ${garamond.variable}`}>
      <body className="min-h-dvh">
        <ProvedorTema>
          <ProvedorToast>{children}</ProvedorToast>
        </ProvedorTema>
        <Analytics />
      </body>
    </html>
  );
}
