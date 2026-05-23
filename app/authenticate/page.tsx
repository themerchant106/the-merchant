import Script from 'next/script';
import { loadPageContent } from '@/lib/page-content';

export default function AuthenticatePage() {
  const { html, scripts } = loadPageContent('authenticate.html');
  return (
    <>
      <div
        className="preserved-page preserved-page--authenticate"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {scripts.map((body, i) => (
        <Script
          key={i}
          id={`authenticate-inline-${i}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ))}
    </>
  );
}
