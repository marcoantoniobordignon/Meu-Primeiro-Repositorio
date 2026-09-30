import Script from "next/script";

/** GA4 via gtag (spec 01). Só entra com NEXT_PUBLIC_GA_ID; track() já sabe usar window.gtag. */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${id}', { anonymize_ip: true, send_page_view: false });`}
      </Script>
    </>
  );
}
