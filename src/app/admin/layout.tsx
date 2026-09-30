import type { Metadata } from "next";

import { ShellAdmin } from "@/components/admin/ShellAdmin";

export const metadata: Metadata = {
  title: "Painel · Ninho",
  robots: { index: false, follow: false },
};

export default function LayoutAdmin({ children }: { children: React.ReactNode }) {
  return <ShellAdmin>{children}</ShellAdmin>;
}
