import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCES = [
  { url: 'https://the-merchant.us', route: 'home' },
  { url: 'https://ceyloncinnoman.netlify.app', route: 'shop' },
  { url: 'https://serendibauthenticate.netlify.app', route: 'authenticate' }
];

export const LINK_REWRITES = [
  // Trailing slash variants first, then bare host.
  [/https?:\/\/the-merchant\.us\/?/g, '/'],
  [/https?:\/\/ceyloncinnoman\.netlify\.app\/?/g, '/shop'],
  [/https?:\/\/serendibauthenticate\.netlify\.app\/?/g, '/authenticate']
];

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
};

const DATA_URI_RE = /data:(image\/[a-z0-9+.-]+);base64,([A-Za-z0-9+/=]+)/g;

/**
 * Decode every base64 data: image URI in `html` to a file under
 * `{baseDir}/public/images/{route}/img-N.{ext}` and replace the URI in-place
 * with the public path `/images/{route}/img-N.{ext}`.
 *
 * Identical URIs are deduplicated to one file.
 */
export async function extractBase64Images(html, route, baseDir) {
  const outDir = path.join(baseDir, 'public', 'images', route);
  await fs.mkdir(outDir, { recursive: true });

  const seen = new Map(); // dataUri -> publicPath
  let counter = 0;
  let result = '';
  let lastIndex = 0;
  let match;

  // Reset regex state for safety across calls.
  DATA_URI_RE.lastIndex = 0;

  while ((match = DATA_URI_RE.exec(html)) !== null) {
    const fullMatch = match[0];
    const mime = match[1].toLowerCase();
    const payload = match[2];

    let publicPath = seen.get(fullMatch);
    if (!publicPath) {
      const ext = MIME_EXT[mime] ?? 'bin';
      const fileName = `img-${counter++}.${ext}`;
      await fs.writeFile(
        path.join(outDir, fileName),
        Buffer.from(payload, 'base64')
      );
      publicPath = `/images/${route}/${fileName}`;
      seen.set(fullMatch, publicPath);
    }

    result += html.slice(lastIndex, match.index) + publicPath;
    lastIndex = DATA_URI_RE.lastIndex;
  }
  result += html.slice(lastIndex);
  return result;
}

/**
 * Replace cross-site URLs with local route paths.
 */
export function rewriteLinks(html) {
  let result = html;
  for (const [pattern, replacement] of LINK_REWRITES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Pull `<link>` and `<style>` from `<head>`, prepend to body innerHTML.
 * Drops `<title>`, `<meta>`, and `<script>` from `<head>`.
 * Throws if `<body>` cannot be found.
 */
export function extractContent(html) {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!bodyMatch) throw new Error('Could not find <body> in source HTML');
  const body = bodyMatch[1];

  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  let headBits = '';
  if (headMatch) {
    const head = headMatch[1];
    const linkTags = [...head.matchAll(/<link\s[^>]*?>/gi)].map(m => m[0]);
    const styleTags = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map(m => m[0]);
    headBits = [...linkTags, ...styleTags].join('\n');
  }

  return headBits + '\n' + body;
}

/**
 * Inspect HTML for things that won't carry over cleanly:
 *  - <script> tags (dangerouslySetInnerHTML won't execute them)
 *  - Netlify Forms (data-netlify="true" — won't work on Vercel)
 *  - Any <form> (worth a human look)
 * Returns an array of warning strings.
 */
export function detectRisks(html, route) {
  const warnings = [];
  if (/<script\b/i.test(html)) {
    warnings.push(`${route}: contains <script> tags — they will NOT execute via dangerouslySetInnerHTML`);
  }
  if (/data-netlify\s*=\s*["']true["']/i.test(html)) {
    warnings.push(`${route}: uses Netlify Forms (data-netlify="true") — will NOT work on Vercel`);
  }
  if (/<form\b/i.test(html)) {
    warnings.push(`${route}: contains <form> elements — verify the submission target still works`);
  }
  return warnings;
}

async function downloadHTML(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Failed to download ${url}: HTTP ${res.status}`);
  return await res.text();
}

async function main() {
  const baseDir = process.cwd();
  await fs.mkdir(path.join(baseDir, 'content'), { recursive: true });

  for (const { url, route } of SOURCES) {
    process.stdout.write(`Processing ${route} from ${url}... `);
    const html = await downloadHTML(url);
    process.stdout.write(`downloaded (${(html.length / 1024 / 1024).toFixed(2)} MB)\n`);

    const warnings = detectRisks(html, route);
    for (const w of warnings) console.warn(`  WARNING: ${w}`);

    const withImages = await extractBase64Images(html, route, baseDir);
    const withLinks = rewriteLinks(withImages);
    const content = extractContent(withLinks);

    const outPath = path.join(baseDir, 'content', `${route}.html`);
    await fs.writeFile(outPath, content);
    console.log(`  Wrote ${path.relative(baseDir, outPath)} (${(content.length / 1024).toFixed(1)} KB)\n`);
  }
  console.log('Done.');
}

// Only run main when invoked as a script (not when imported by tests).
const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
