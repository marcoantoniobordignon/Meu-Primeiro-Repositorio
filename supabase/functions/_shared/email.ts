// E-mail transacional (funcionalidade 14). O provedor é decisão em aberto: aqui vai um POST no formato comum
// (`from`, `to`, `subject`, `text`, `html`, Bearer), que serve ao Resend e a provedores compatíveis.
// Segredos: EMAIL_API_KEY, EMAIL_FROM e, opcional, EMAIL_API_URL. Sem chave, nada sai e a função devolve false.
export interface Email {
  para: string;
  assunto: string;
  texto: string;
}

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function emailConfigurado(): boolean {
  return Boolean(Deno.env.get("EMAIL_API_KEY") && Deno.env.get("EMAIL_FROM"));
}

export async function enviarEmail(m: Email): Promise<boolean> {
  const chave = Deno.env.get("EMAIL_API_KEY");
  const de = Deno.env.get("EMAIL_FROM");
  if (!chave || !de) {
    console.warn("e-mail não configurado (EMAIL_API_KEY/EMAIL_FROM): não enviado");
    return false;
  }
  const html = m.texto
    .split(/\n\s*\n/)
    .map((p) => `<p>${escapar(p).replace(/\n/g, "<br>").replace(/(https:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>`)
    .join("");
  const r = await fetch(Deno.env.get("EMAIL_API_URL") ?? "https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: de, to: [m.para], subject: m.assunto, text: m.texto, html }),
  });
  if (!r.ok) console.error("e-mail recusado", r.status);
  return r.ok;
}
