import Script from 'next/script';
import { loadPageContent } from '@/lib/page-content';

export default function ShopPage() {
  const { html, scripts } = loadPageContent('shop.html');
  return (
    <>
      <div
        className="preserved-page preserved-page--shop"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {scripts.map((body, i) => (
        <Script
          key={i}
          id={`shop-inline-${i}`}
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ))}
    </>
  );
}
