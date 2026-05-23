import { InlineScripts } from '@/lib/InlineScripts';
import { loadPageContent } from '@/lib/page-content';

export default function HomePage() {
  const { stylesheets, styles, html, scripts } = loadPageContent('home.html');
  return (
    <>
      {stylesheets.map((href, i) => (
        <link key={`ss-${i}`} rel="stylesheet" href={href} />
      ))}
      {styles.map((css, i) => (
        <style key={`st-${i}`} dangerouslySetInnerHTML={{ __html: css }} />
      ))}
      <div
        className="preserved-page preserved-page--home"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <InlineScripts scripts={scripts} />
    </>
  );
}
