import { InlineScripts } from '@/lib/InlineScripts';
import { loadPageContent } from '@/lib/page-content';

export default function ShopPage() {
  const { stylesheets, styles, html, scripts } = loadPageContent('shop.html');
  return (
    <>
      {stylesheets.map((href, i) => (
        <link key={`ss-${i}`} rel="stylesheet" href={href} />
      ))}
      {styles.map((css, i) => (
        <style key={`st-${i}`} dangerouslySetInnerHTML={{ __html: css }} />
      ))}
      <div
        className="preserved-page preserved-page--shop"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <InlineScripts scripts={scripts} />
    </>
  );
}
