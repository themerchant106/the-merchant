# The Merchant Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate three Netlify-hosted pages (`the-merchant.us`, `ceyloncinnoman.netlify.app`, `serendibauthenticate.netlify.app`) into a single Vercel-hosted Next.js project, backed by a new GitHub repo. Preserve each page's original design; extract base64-inlined images to real files; add a shared top nav linking the three routes.

**Architecture:** Next.js 15 App Router project, statically exported (`output: 'export'`). A one-shot Node script (`scripts/extract.mjs`) downloads each live Netlify page, decodes base64 images to `public/images/{route}/*`, rewrites cross-site links to local routes, and writes the cleaned HTML to `content/{route}.html`. Three `page.tsx` files inject that HTML via `dangerouslySetInnerHTML`. A `layout.tsx` adds the shared nav. No backend, no client state.

**Tech Stack:** Node 18.18+ (user has 18.19.1, sufficient for Next.js 15), Next.js 15, React 18, TypeScript (strict), `node:test` for unit tests, `gh` CLI, Vercel.

**Working directory throughout the plan:** `/mnt/c/Users/tyaku/the-merchant`

**Spec:** [`docs/superpowers/specs/2026-05-23-merchant-migration-design.md`](../specs/2026-05-23-merchant-migration-design.md)

---

## Task 1: Install GitHub CLI (no sudo)

**Files:** none (system setup). Installs `gh` to `~/.local/bin/gh` to avoid needing root.

- [ ] **Step 1.1: Verify Node is at least 18.18**

Run: `node --version`
Expected: `v18.18.x` or higher. Next.js 15 requires ≥18.18.0; the user has 18.19.1 which is fine.

(Skip the Node 20 upgrade — we only would have needed it for the Netlify MCP, which is not in our toolchain.)

- [ ] **Step 1.2: Create ~/.local/bin if not present**

Run: `mkdir -p ~/.local/bin && echo $HOME/.local/bin`

- [ ] **Step 1.3: Download the latest gh CLI tarball**

Run:
```bash
cd /tmp
GH_VERSION=$(curl -fsSL https://api.github.com/repos/cli/cli/releases/latest | grep -oE '"tag_name":\s*"v[0-9.]+"' | grep -oE '[0-9.]+')
echo "Installing gh v$GH_VERSION"
ARCH=$(dpkg --print-architecture)  # amd64 on most WSL setups
curl -fsSL -o gh.tar.gz "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${ARCH}.tar.gz"
tar -xzf gh.tar.gz
cp gh_${GH_VERSION}_linux_${ARCH}/bin/gh ~/.local/bin/gh
chmod +x ~/.local/bin/gh
rm -rf gh.tar.gz gh_${GH_VERSION}_linux_${ARCH}
```

- [ ] **Step 1.4: Ensure ~/.local/bin is on PATH**

Run: `echo "$PATH" | tr ':' '\n' | grep -q "$HOME/.local/bin" && echo "OK: on PATH" || echo "MISSING"`

If MISSING, add to PATH in the shell's rc file (~/.bashrc or ~/.zshrc):

```bash
grep -q 'HOME/.local/bin' ~/.bashrc 2>/dev/null || echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
```

Then either `source ~/.bashrc` or open a new shell. For the rest of this plan, use the full path `~/.local/bin/gh` to avoid PATH issues.

- [ ] **Step 1.5: Verify gh is installed**

Run: `~/.local/bin/gh --version`
Expected: `gh version 2.x.x ...`

Do NOT run `gh auth login` yet — that's in Task 11.

- [ ] **Step 1.6: Commit nothing**

This task installs user-level tooling only; nothing to commit.

---

## Task 2: Scaffold the Next.js project

**Files:**
- Create: `/mnt/c/Users/tyaku/the-merchant/package.json`
- Create: `/mnt/c/Users/tyaku/the-merchant/tsconfig.json`
- Create: `/mnt/c/Users/tyaku/the-merchant/next.config.mjs`
- Create: `/mnt/c/Users/tyaku/the-merchant/.gitignore`
- Create: `/mnt/c/Users/tyaku/the-merchant/.eslintrc.json`
- Create: `/mnt/c/Users/tyaku/the-merchant/app/globals.css` (placeholder, populated in Task 6)

- [ ] **Step 2.1: Create package.json**

```json
{
  "name": "the-merchant",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "extract": "node scripts/extract.mjs",
    "extract:test": "node --test scripts/extract.test.mjs",
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^15.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2.2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "scripts"]
}
```

- [ ] **Step 2.3: Create next.config.mjs**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true
  },
  trailingSlash: false
};

export default nextConfig;
```

- [ ] **Step 2.4: Create .gitignore**

```
# deps
node_modules/

# next
.next/
out/

# misc
.DS_Store
*.log
.env*
!.env.example

# IDE
.vscode/
.idea/

# Next.js generated
next-env.d.ts
```

- [ ] **Step 2.5: Create .eslintrc.json**

```json
{
  "extends": "next/core-web-vitals"
}
```

- [ ] **Step 2.6: Create empty app/globals.css**

```css
/* Shared layout styles (nav). Populated in Task 6. */
```

- [ ] **Step 2.7: Install dependencies**

Run from `/mnt/c/Users/tyaku/the-merchant`:
```bash
npm install
```

Expected: completes without errors. A `node_modules/` directory and `package-lock.json` are created.

- [ ] **Step 2.8: Verify Next.js is installed**

Run: `ls node_modules/next/package.json && node -e "console.log(require('next/package.json').version)"`
Expected: prints a 15.x version string.

(Skip a `tsc --noEmit` check here — there are no `.ts` files yet, and Next won't generate `next-env.d.ts` until first invocation.)

- [ ] **Step 2.9: Commit**

```bash
cd /mnt/c/Users/tyaku/the-merchant
git init
git add package.json package-lock.json tsconfig.json next.config.mjs .gitignore .eslintrc.json app/globals.css
git commit -m "chore: scaffold Next.js project with TypeScript and static export"
```

If `git init` was already done earlier, skip it. The commit should not include `node_modules/`.

---

## Task 3: Write extract script tests (TDD — failing)

**Files:**
- Create: `/mnt/c/Users/tyaku/the-merchant/scripts/extract.test.mjs`
- Create (empty): `/mnt/c/Users/tyaku/the-merchant/scripts/extract.mjs`

- [ ] **Step 3.1: Create empty scripts/extract.mjs**

```js
// Implementation in Task 4.
export {};
```

- [ ] **Step 3.2: Write the test file**

Create `scripts/extract.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import {
  extractBase64Images,
  rewriteLinks,
  extractContent,
  detectRisks
} from './extract.mjs';

// Small valid 1x1 PNG (transparent), base64-encoded.
const ONE_PX_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

// Small valid 1x1 JPEG, base64-encoded.
const ONE_PX_JPG_BASE64 =
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AAAA//Z';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'extract-test-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('extractBase64Images: writes PNG file and rewrites src attribute', async () => {
  await withTempDir(async (tmp) => {
    const html = `<html><body><img src="data:image/png;base64,${ONE_PX_PNG_BASE64}" /></body></html>`;
    const result = await extractBase64Images(html, 'home', tmp);
    const files = await readdir(path.join(tmp, 'public', 'images', 'home'));
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('.png'), `expected .png, got ${files[0]}`);
    assert.match(result, /src="\/images\/home\/img-0\.png"/);
    assert.ok(!result.includes('data:image/png;base64'), 'data URI should be gone');
  });
});

test('extractBase64Images: handles JPEG with image/jpeg mime', async () => {
  await withTempDir(async (tmp) => {
    const html = `<img src="data:image/jpeg;base64,${ONE_PX_JPG_BASE64}" />`;
    const result = await extractBase64Images(html, 'home', tmp);
    const files = await readdir(path.join(tmp, 'public', 'images', 'home'));
    assert.equal(files.length, 1);
    assert.ok(files[0].endsWith('.jpg'));
    assert.match(result, /src="\/images\/home\/img-0\.jpg"/);
  });
});

test('extractBase64Images: deduplicates identical data URIs to one file', async () => {
  await withTempDir(async (tmp) => {
    const uri = `data:image/png;base64,${ONE_PX_PNG_BASE64}`;
    const html = `<img src="${uri}" /><img src="${uri}" /><div style="background-image: url(${uri})"></div>`;
    const result = await extractBase64Images(html, 'home', tmp);
    const files = await readdir(path.join(tmp, 'public', 'images', 'home'));
    assert.equal(files.length, 1, 'identical data URIs should produce one file');
    // All three references should point at the same file
    const matches = result.match(/\/images\/home\/img-0\.png/g);
    assert.equal(matches.length, 3);
  });
});

test('extractBase64Images: distinct URIs produce distinct files with incrementing ids', async () => {
  await withTempDir(async (tmp) => {
    const html = `
      <img src="data:image/png;base64,${ONE_PX_PNG_BASE64}" />
      <img src="data:image/jpeg;base64,${ONE_PX_JPG_BASE64}" />
    `;
    const result = await extractBase64Images(html, 'home', tmp);
    const files = (await readdir(path.join(tmp, 'public', 'images', 'home'))).sort();
    assert.equal(files.length, 2);
    assert.deepEqual(files, ['img-0.png', 'img-1.jpg']);
  });
});

test('rewriteLinks: rewrites the-merchant.us to root', () => {
  const html = `<a href="https://the-merchant.us">home</a><a href="https://the-merchant.us/">also home</a>`;
  const result = rewriteLinks(html);
  assert.match(result, /href="\/">home/);
  assert.match(result, /href="\/">also home/);
});

test('rewriteLinks: rewrites ceyloncinnoman.netlify.app to /shop', () => {
  const html = `<a href="https://ceyloncinnoman.netlify.app/">shop</a>`;
  const result = rewriteLinks(html);
  assert.match(result, /href="\/shop">shop/);
});

test('rewriteLinks: rewrites serendibauthenticate.netlify.app to /authenticate', () => {
  const html = `<a href="https://serendibauthenticate.netlify.app/">auth</a>`;
  const result = rewriteLinks(html);
  assert.match(result, /href="\/authenticate">auth/);
});

test('rewriteLinks: leaves unrelated external links alone', () => {
  const html = `<a href="https://fonts.googleapis.com/css2?family=Foo">font</a>`;
  const result = rewriteLinks(html);
  assert.equal(result, html);
});

test('extractContent: pulls link tags and style tags from head plus body innerHTML', () => {
  const html = `
    <html>
      <head>
        <title>Ignore me</title>
        <meta charset="utf-8">
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel">
        <style>body { color: red; }</style>
        <script>alert('nope')</script>
      </head>
      <body>
        <main>Hello</main>
      </body>
    </html>
  `;
  const result = extractContent(html);
  assert.match(result, /<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com\/css2\?family=Cinzel">/);
  assert.match(result, /<style>body \{ color: red; \}<\/style>/);
  assert.match(result, /<main>Hello<\/main>/);
  assert.ok(!result.includes('<title>'), 'title tag should be dropped');
  assert.ok(!result.includes('<meta'), 'meta tags should be dropped');
  assert.ok(!result.includes('<script>'), 'script tags from head should be dropped');
});

test('extractContent: throws helpful error if body is missing', () => {
  const html = `<html><head></head></html>`;
  assert.throws(() => extractContent(html), /body/i);
});

test('detectRisks: flags <script> tags in body', () => {
  const html = `<html><body><script>doStuff()</script></body></html>`;
  const warnings = detectRisks(html, 'home');
  assert.ok(warnings.some(w => w.includes('script')), `expected script warning, got: ${warnings}`);
});

test('detectRisks: flags Netlify Forms attribute', () => {
  const html = `<form data-netlify="true"></form>`;
  const warnings = detectRisks(html, 'home');
  assert.ok(warnings.some(w => w.toLowerCase().includes('netlify')), `expected netlify warning, got: ${warnings}`);
});

test('detectRisks: flags plain forms even without netlify attribute', () => {
  const html = `<form action="/submit"></form>`;
  const warnings = detectRisks(html, 'home');
  assert.ok(warnings.some(w => w.toLowerCase().includes('form')), `expected form warning, got: ${warnings}`);
});

test('detectRisks: clean HTML produces no warnings', () => {
  const html = `<html><body><h1>hi</h1></body></html>`;
  const warnings = detectRisks(html, 'home');
  assert.equal(warnings.length, 0);
});
```

- [ ] **Step 3.3: Run tests to verify they fail**

Run: `npm run extract:test`
Expected: all tests fail with errors like `TypeError: extractBase64Images is not a function` (because `extract.mjs` is empty).

- [ ] **Step 3.4: Commit failing tests**

```bash
git add scripts/
git commit -m "test: add unit tests for extract.mjs helpers"
```

---

## Task 4: Implement extract.mjs

**Files:**
- Modify: `/mnt/c/Users/tyaku/the-merchant/scripts/extract.mjs`

- [ ] **Step 4.1: Replace scripts/extract.mjs with the full implementation**

```js
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
```

- [ ] **Step 4.2: Run tests to verify they pass**

Run: `npm run extract:test`
Expected: all 14 tests pass.

If any fail, fix `extract.mjs` and re-run. Do not modify the tests to make them pass.

- [ ] **Step 4.3: Commit**

```bash
git add scripts/extract.mjs
git commit -m "feat: implement extract.mjs (base64 image extraction, link rewriting, content extraction, risk detection)"
```

---

## Task 5: Run extraction against the 3 live sites and review warnings

**Files:**
- Will be created by the script:
  - `content/home.html`, `content/shop.html`, `content/authenticate.html`
  - `public/images/home/*`, `public/images/shop/*`, `public/images/authenticate/*`

- [ ] **Step 5.1: Run the extraction**

Run from `/mnt/c/Users/tyaku/the-merchant`:
```bash
npm run extract
```

Expected output (sizes approximate):
```
Processing home from https://the-merchant.us... downloaded (31.41 MB)
  Wrote content/home.html (... KB)

Processing shop from https://ceyloncinnoman.netlify.app... downloaded (0.71 MB)
  Wrote content/shop.html (... KB)

Processing authenticate from https://serendibauthenticate.netlify.app... downloaded (0.08 MB)
  Wrote content/authenticate.html (... KB)

Done.
```

Watch for `WARNING:` lines. Note any that appear and continue to Step 5.2.

- [ ] **Step 5.2: Inspect extracted output**

Run:
```bash
ls -la public/images/home public/images/shop public/images/authenticate
wc -c content/home.html content/shop.html content/authenticate.html
du -sh public/images
```

Expected:
- `public/images/home` has ~15 files
- `public/images/shop` has ~4 files
- `public/images/authenticate` has ~1 file
- `content/home.html` is dramatically smaller than 32 MB (target: under 200 KB)
- Total image dir is under ~10 MB

- [ ] **Step 5.3: Verify a sample image opens**

Run: `file public/images/home/img-0.*`
Expected: shows the file is a valid PNG/JPEG/etc., not "data" or zero bytes.

- [ ] **Step 5.4: Address `<script>` warnings if any**

If Step 5.1 warned that any page has `<script>` tags:

Run: `grep -oE '<script[^>]*>' content/{home,shop,authenticate}.html | sort | uniq -c`

**Important:** `dangerouslySetInnerHTML` does NOT execute `<script>` tags — neither inline nor external `src=`. Any script that needs to run must be re-added separately.

For each `<script>` tag found, decide and document:
1. **Discard** — analytics, ad scripts, or anything not needed for the migration. Commit message should call out what was dropped.
2. **Re-add via `next/script`** — interactive features like product galleries, modals, etc. Note the script `src` or inline body and add it as a `<Script>` component in the relevant `page.tsx` during Task 7. Add a placeholder comment in `content/{route}.html` near where the script lived (e.g. `<!-- script moved to page.tsx: <name> -->`).

If any scripts need re-adding, **list them now in your scratch notes** so Task 7 picks them up.

If none of the scripts are needed, document the decision in the next commit message and proceed.

- [ ] **Step 5.5: Address Netlify Forms warnings if any**

If Step 5.1 warned about `data-netlify="true"`:
- The form will render but submissions will 404.
- Pause and ask the user whether to:
  - (a) Replace with a `mailto:` link
  - (b) Set up a Vercel-compatible form handler (e.g. Formspree, Resend, an API route)
  - (c) Leave the form non-functional for now and flag it

Document the decision in a follow-up task.

- [ ] **Step 5.6: Commit extracted content**

```bash
git add content/ public/images/
git commit -m "feat: extract content and assets from live Netlify sites"
```

This commit will include the binary image files. That's intentional — they're part of the canonical site source now.

---

## Task 6: Build the shared layout and nav

**Files:**
- Modify: `/mnt/c/Users/tyaku/the-merchant/app/globals.css`
- Create: `/mnt/c/Users/tyaku/the-merchant/app/layout.tsx`

- [ ] **Step 6.1: Replace app/globals.css**

```css
/* Shared layout styles — applies only to the top nav.
   Each route's original page CSS is loaded inside its own page body. */

:root {
  --nav-bg: rgba(255, 255, 255, 0.94);
  --nav-fg: #1a1208;
  --nav-accent: #8a6a3a;
  --nav-font: 'Cinzel', Georgia, serif;
}

* { box-sizing: border-box; }

body { margin: 0; padding: 0; }

.site-nav {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1.5rem;
  background: var(--nav-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  font-family: var(--nav-font);
  letter-spacing: 0.12em;
}

.site-nav__wordmark {
  font-weight: 500;
  font-size: 1rem;
  text-transform: uppercase;
  color: var(--nav-fg);
  text-decoration: none;
}

.site-nav__links {
  display: flex;
  gap: 1.75rem;
}

.site-nav__link {
  color: var(--nav-fg);
  text-decoration: none;
  font-size: 0.85rem;
  text-transform: uppercase;
  padding: 0.25rem 0;
  border-bottom: 1px solid transparent;
  transition: border-color 120ms ease, color 120ms ease;
}

.site-nav__link:hover,
.site-nav__link[aria-current='page'] {
  border-bottom-color: var(--nav-accent);
  color: var(--nav-accent);
}

@media (max-width: 600px) {
  .site-nav { padding: 0.5rem 1rem; }
  .site-nav__links { gap: 1rem; }
  .site-nav__link { font-size: 0.75rem; }
}
```

- [ ] **Step 6.2: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Merchant',
  description: 'Quality is an Intelligent Effort.'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <nav className="site-nav" aria-label="Primary">
          <Link href="/" className="site-nav__wordmark">
            The Merchant
          </Link>
          <div className="site-nav__links">
            <Link href="/" className="site-nav__link">Home</Link>
            <Link href="/shop" className="site-nav__link">Shop</Link>
            <Link href="/authenticate" className="site-nav__link">Authenticate</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

Note: We're NOT marking the active link via `aria-current` here — Next.js App Router would need a client component for `usePathname`. The CSS hover state is sufficient for now. If needed later, convert to a client component.

- [ ] **Step 6.3: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6.4: Commit**

```bash
git add app/layout.tsx app/globals.css
git commit -m "feat: add shared layout with top nav"
```

---

## Task 7: Build the three page components

**Files:**
- Create: `/mnt/c/Users/tyaku/the-merchant/app/page.tsx`
- Create: `/mnt/c/Users/tyaku/the-merchant/app/shop/page.tsx`
- Create: `/mnt/c/Users/tyaku/the-merchant/app/authenticate/page.tsx`

- [ ] **Step 7.1: Create app/page.tsx (home)**

```tsx
import fs from 'node:fs';
import path from 'node:path';

export default function HomePage() {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'content/home.html'),
    'utf-8'
  );
  return (
    <div
      className="preserved-page preserved-page--home"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 7.2: Create app/shop/page.tsx**

```tsx
import fs from 'node:fs';
import path from 'node:path';

export default function ShopPage() {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'content/shop.html'),
    'utf-8'
  );
  return (
    <div
      className="preserved-page preserved-page--shop"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 7.3: Create app/authenticate/page.tsx**

```tsx
import fs from 'node:fs';
import path from 'node:path';

export default function AuthenticatePage() {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'content/authenticate.html'),
    'utf-8'
  );
  return (
    <div
      className="preserved-page preserved-page--authenticate"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
```

- [ ] **Step 7.4: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7.5: Commit**

```bash
git add app/page.tsx app/shop/page.tsx app/authenticate/page.tsx
git commit -m "feat: add three route pages that inject preserved HTML content"
```

---

## Task 8: Local smoke test

**Files:** none modified (read-only verification)

- [ ] **Step 8.1: Start the dev server**

Run: `npm run dev`

Expected: server starts on `http://localhost:3000` within ~5 seconds.

- [ ] **Step 8.2: Manually verify each route**

In a browser, open in order:
- `http://localhost:3000/` → home page renders, with shared nav on top.
- `http://localhost:3000/shop` → ceyloncinnoman content renders.
- `http://localhost:3000/authenticate` → serendib content renders.

For each route, in DevTools Network panel, confirm:
- No 404s on `/images/...` requests.
- No `data:image/...` blobs being downloaded (those should all be replaced).
- Google Fonts requests succeed.

- [ ] **Step 8.3: Click cross-route links**

On the home page, click any link that used to point to `ceyloncinnoman.netlify.app` or `serendibauthenticate.netlify.app`. Verify they navigate to `/shop` and `/authenticate` respectively (and do NOT go to the live Netlify URLs).

- [ ] **Step 8.4: Click in-page anchor links**

On the home page, click `#about`, `#for-whom`, `#product`, `#authenticate`, `#faq`, `#contact` in the original page nav. Verify they scroll to the corresponding section. (Note: `#authenticate` here means the in-page section, not the `/authenticate` route. Both can coexist.)

- [ ] **Step 8.5: Verify CSS isolation between routes**

Navigate between `/`, `/shop`, `/authenticate` multiple times. Each page should display with its own styling, not bleeding into the others.

If you see styling bleed (one page's CSS affecting another), it's because the preserved `<style>` blocks include global selectors like `body { ... }`. Next.js's client-side navigation doesn't re-parse `<head>` styles. Solutions in priority order:
1. Add `<meta name="next-size-adjust" />` (no — irrelevant)
2. Force a hard navigation between preserved pages by using `<a href>` in the nav instead of Next's `<Link>` (simpler — the nav already uses `<Link>`; swap it out if bleed is observed).
3. Scope each page's CSS by wrapping its content in a uniquely-classed `<div>` and rewriting top-level selectors. (Most robust but invasive.)

Pick the first that works and document the choice.

- [ ] **Step 8.6: Stop the dev server**

Press Ctrl+C in the terminal.

- [ ] **Step 8.7: Commit any fixes from Step 8.5 if needed**

If you converted nav links from `<Link>` to `<a href>` in `app/layout.tsx`:
```bash
git add app/layout.tsx
git commit -m "fix: use hard nav links to prevent CSS bleed between preserved pages"
```

Otherwise no commit needed for this task.

---

## Task 9: Static export build

**Files:** generated under `out/` (gitignored)

- [ ] **Step 9.1: Build**

Run: `npm run build`

Expected: builds without errors. Last line shows route summary like:
```
Route (app)                              Size     First Load JS
┌ ○ /                                    ... B    ... kB
├ ○ /_not-found                          ... B    ... kB
├ ○ /authenticate                        ... B    ... kB
└ ○ /shop                                ... B    ... kB
○  (Static)  prerendered as static content
```

All routes should be marked `○ (Static)`.

If the build fails with "Image Optimization API is not supported when using static export" or similar, recheck `next.config.mjs` — `images.unoptimized` must be `true`.

- [ ] **Step 9.2: Inspect the output**

Run:
```bash
ls -la out/
ls -la out/shop out/authenticate
du -sh out/
```

Expected:
- `out/index.html`, `out/shop/index.html`, `out/authenticate/index.html` all exist
- `out/images/home/`, `out/images/shop/`, `out/images/authenticate/` contain the extracted images
- Total `out/` size is reasonable (under ~15 MB)

- [ ] **Step 9.3: Spot-check the built HTML**

Run: `head -c 2000 out/index.html`

Verify it does not contain `data:image/...;base64,` (those should all have been replaced) and references images via `/images/home/img-N.{ext}` paths.

- [ ] **Step 9.4: Commit nothing**

`out/` is gitignored. No commit needed.

---

## Task 10: Initialize git and prepare for push

**Files:** none modified (git plumbing)

- [ ] **Step 10.1: Verify git status is clean**

Run: `git status`
Expected: "nothing to commit, working tree clean" (all earlier commits were made per-task).

- [ ] **Step 10.2: Check the commit history**

Run: `git log --oneline`
Expected: 6 or 7 commits showing the build-up: scaffold → extract tests → extract impl → extracted content → layout → pages → (optional CSS-bleed fix).

- [ ] **Step 10.3: Set the default branch to main if not already**

Run: `git branch -m main` (no-op if already on `main`).

Run: `git branch --show-current`
Expected: `main`.

- [ ] **Step 10.4: Add a minimal README**

Create `README.md`:

```markdown
# The Merchant

Unified Vercel-hosted site combining the three previously-separate Netlify pages:
- `/` — main brand site (was `the-merchant.us`)
- `/shop` — Ceylon Cinnamon product page (was `ceyloncinnoman.netlify.app`)
- `/authenticate` — Serendib Authenticate portal (was `serendibauthenticate.netlify.app`)

## Stack
- Next.js 15 (App Router, static export)
- TypeScript

## Setup
```bash
npm install
npm run extract   # re-downloads from Netlify if you ever need to refresh
npm run dev       # local server at http://localhost:3000
npm run build     # static export to out/
```

## How it works
A one-shot Node script (`scripts/extract.mjs`) downloads each live Netlify
page, decodes inline base64 images to real files under `public/images/`,
rewrites cross-site links to local routes, and writes the cleaned HTML to
`content/{route}.html`. Three `page.tsx` files inject that HTML via
`dangerouslySetInnerHTML`. A `layout.tsx` adds the shared top nav.

The original page designs are preserved verbatim; only the navigation and
asset paths change.
```

- [ ] **Step 10.5: Commit the README**

```bash
git add README.md
git commit -m "docs: add README"
```

---

## Task 11: Authenticate with GitHub and create the remote repo

**Files:** none

- [ ] **Step 11.1: Run `gh auth login`**

Run: `~/.local/bin/gh auth login`

This is an INTERACTIVE flow. If running as an agent without a TTY, pause and ask the user to run it themselves and report back.

Choose: GitHub.com → HTTPS → Yes, authenticate Git with credentials → Login with a web browser.

The CLI prints a one-time code and opens a URL. The user pastes the code on github.com to grant access.

- [ ] **Step 11.2: Verify auth**

Run: `~/.local/bin/gh auth status`
Expected: "Logged in to github.com account <username>".

- [ ] **Step 11.3: Create the repo and push**

Run from `/mnt/c/Users/tyaku/the-merchant`:
```bash
~/.local/bin/gh repo create the-merchant --public --source=. --remote=origin --push
```

Expected: repo created at `https://github.com/<username>/the-merchant`, branch `main` pushed.

If the repo name is already taken, retry with a different name (`the-merchant-site`, `merchant-web`, etc.) and tell the user the actual name used.

- [ ] **Step 11.4: Verify the push**

Run: `git remote -v && git log --oneline origin/main | head -5`
Expected: `origin` points at the new GitHub URL, and `origin/main` has the same commits as local.

---

## Task 12: Deploy to Vercel and verify

**Files:** none on disk; this is a configuration task in the Vercel dashboard.

- [ ] **Step 12.1: Walk the user through Vercel deploy**

The user already has Vercel access (per the session start). Either guide them through the dashboard or use the Vercel MCP. Steps in the dashboard:

1. Go to https://vercel.com/new
2. Click "Import" next to the new `the-merchant` GitHub repo (Vercel may prompt to install the GitHub app on the repo first — approve it).
3. Framework Preset: Next.js (auto-detected).
4. Build Command: leave default (`next build`).
5. Output Directory: leave default (`out`, since `output: 'export'`).
6. Click "Deploy".

Expected: deploy completes in 1-3 minutes. Vercel returns a URL like `the-merchant-<hash>.vercel.app`.

- [ ] **Step 12.2: Verify all three routes on the live URL**

Open in a browser:
- `https://<deploy-url>.vercel.app/` → home renders
- `https://<deploy-url>.vercel.app/shop` → shop renders
- `https://<deploy-url>.vercel.app/authenticate` → authenticate renders

For each route, confirm:
- [ ] Page renders without console errors (open DevTools console)
- [ ] All images load (no 404s in Network tab)
- [ ] Google Fonts load
- [ ] Shared nav appears at top, links work
- [ ] Cross-route links (e.g. on home → shop) go to internal routes, not Netlify URLs
- [ ] In-page anchor links on home work
- [ ] Total page weight for `/` in the Network tab is well under the original 32 MB

- [ ] **Step 12.3: Hand off**

Report to the user:
1. The GitHub repo URL.
2. The Vercel deploy URL.
3. Any open follow-ups (scripts that need to be re-added via `<Script>` if Task 5 surfaced any, any forms that need a handler, any visual issues observed).
4. A reminder that `the-merchant.us` DNS still points at Netlify — that's a deliberate deferral per the spec.

---

## Notes and assumptions for the executor

- **No new dependencies** beyond `next`, `react`, `react-dom`, and dev tooling. The extraction script uses Node built-ins only (`fetch`, `fs/promises`, `path`, `node:test`).
- **No tests for the React components.** The page components are thin wrappers around `dangerouslySetInnerHTML`; their correctness is verified by the smoke test in Task 8. Adding unit/snapshot tests would be ceremony for ceremony's sake.
- **Image files are committed to the repo.** They're part of the canonical site source and the user explicitly wants "a github for all my work."
- **The extract script is idempotent.** Re-running `npm run extract` will overwrite `content/*.html` and `public/images/**` from the live Netlify sites. If the Netlify sites are eventually decommissioned, the script becomes a historical artifact; the committed `content/` and `public/images/` directories remain.
- **If a step fails**, stop and report. Do not paper over errors with retries or workarounds. The spec calls out specific risks (inline scripts, Netlify Forms, CSS bleed) that need real decisions, not silent suppression.
