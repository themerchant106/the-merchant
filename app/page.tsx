import Script from 'next/script';
import { loadPageContent } from '@/lib/page-content';

export default function HomePage() {
  const { html, scripts } = loadPageContent('home.html');
  return (
    <>
      <div
        className="preserved-page preserved-page--home"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {scripts.map((body, i) => (
        <Script
          key={i}
          id={`home-inline-${i}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ))}
    </>
  );
}
