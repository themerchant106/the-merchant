import fs from 'node:fs';
import path from 'node:path';

export type PageContent = {
  html: string;
  scripts: string[];
};

export function loadPageContent(file: string): PageContent {
  const raw = fs.readFileSync(
    path.join(process.cwd(), 'content', file),
    'utf-8'
  );
  const scripts: string[] = [];
  const html = raw.replace(
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    (_, body: string) => {
      scripts.push(body);
      return '';
    }
  );
  return { html, scripts };
}
