import fs from 'node:fs';
import path from 'node:path';

export type PageContent = {
  /** href values of <link rel="stylesheet"> tags carried over from the original <head> */
  stylesheets: string[];
  /** Inline CSS bodies from <style> tags */
  styles: string[];
  /** The rest of the HTML (body content), with <link>, <style>, and <script> stripped */
  html: string;
  /** Inline script bodies (need to execute after hydration) */
  scripts: string[];
};

export function loadPageContent(file: string): PageContent {
  const raw = fs.readFileSync(
    path.join(process.cwd(), 'content', file),
    'utf-8'
  );

  const scripts: string[] = [];
  const styles: string[] = [];
  const stylesheets: string[] = [];

  let html = raw;

  html = html.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (_, body: string) => {
      scripts.push(body);
      return '';
    }
  );

  html = html.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (_, body: string) => {
      styles.push(body);
      return '';
    }
  );

  // Pull out <link rel="stylesheet" href="..."> (the only kind we need to re-render in <head>)
  html = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi,
    (tag: string) => {
      const m = tag.match(/href=["']([^"']+)["']/i);
      if (m) stylesheets.push(m[1]);
      return '';
    }
  );

  // Also strip any leftover <link rel="preconnect"> etc. that came from <head>;
  // they're cheap and Next.js already preconnects what we need from layout.
  html = html.replace(/<link\b[^>]*>/gi, '');

  return { stylesheets, styles, html, scripts };
}
