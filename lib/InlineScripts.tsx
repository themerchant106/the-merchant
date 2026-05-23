'use client';

import { useEffect } from 'react';

/**
 * Inject inline script bodies after hydration by creating real <script>
 * elements. Next.js's <Script dangerouslySetInnerHTML> wraps the body in
 * the RSC payload, which doesn't reliably execute for the preserved-page
 * inline scripts (IntersectionObserver for .reveal, FAQ accordion, etc.).
 *
 * Creating fresh <script> elements via createElement + appendChild causes
 * the browser to execute them synchronously, matching the behavior of an
 * inline <script> tag in the original Netlify HTML.
 */
export function InlineScripts({ scripts }: { scripts: string[] }) {
  useEffect(() => {
    const injected: HTMLScriptElement[] = [];
    for (const body of scripts) {
      try {
        const el = document.createElement('script');
        el.text = body;
        document.body.appendChild(el);
        injected.push(el);
      } catch (e) {
        // Don't let one broken script break the others.
        console.error('InlineScripts: failed to inject', e);
      }
    }
    return () => {
      for (const el of injected) el.remove();
    };
  }, [scripts]);

  return null;
}
