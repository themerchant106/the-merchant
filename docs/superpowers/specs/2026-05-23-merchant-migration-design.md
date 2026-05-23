# The Merchant — Netlify to Vercel Migration

**Date:** 2026-05-23
**Status:** Draft — pending user review

## Goal

Consolidate three Netlify sites (`the-merchant.us`, `serendibauthenticate.netlify.app`, `ceyloncinnoman.netlify.app`) into a single unified site hosted on Vercel, backed by a new GitHub repository. The three sites are different facets of one brand ("The Merchant" — a Ceylon cinnamon trading house) and should function as one site with internal routes rather than three separate domains.

## Non-goals

- Visual redesign or unification of the three pages' styles.
- Pointing the-merchant.us DNS at Vercel during this migration (user has chosen to use the `*.vercel.app` URL initially and switch DNS later).
- Removing the duplicate `#product` and `#authenticate` sections from the home page (user wants original content preserved as-is).
- Filling in placeholder/under-construction content on the Serendib Authenticate page.
- Migrating Netlify forms, redirects, build plugins, or environment variables (the sources appear to be static HTML; none of these are in use).

## Constraints

- **No source code available.** None of the three Netlify projects have a known source repository, and no local source folders exist on the user's machine. The Netlify MCP server is currently broken on the user's Node 18 installation, so we cannot pull builds from Netlify directly. We will reconstruct from the live-deployed HTML.
- **Source pages are static and image-heavy.** The home page (`the-merchant.us`) is a 32 MB single HTML file with 15 base64-inlined images. The other two pages are smaller (730 KB and 82 KB respectively).
- **User wants a clean GitHub repo** as the canonical store of their work going forward. The GitHub CLI (`gh`) is not currently installed on the user's machine.
- **Working directory:** `/mnt/c/Users/tyaku/the-merchant` (WSL Ubuntu on Windows).

## Source inventory

| Source URL | Size | Inline base64 images | Title | Role |
|------------|------|---------------------|-------|------|
| `https://the-merchant.us` | 32 MB | 15 | "The Merchant — Quality is an Intelligent Effort" | Single-page brand site with `#home`, `#about`, `#for-whom`, `#product`, `#authenticate`, `#faq`, `#contact` sections. Already cross-links to the other two sites. |
| `https://ceyloncinnoman.netlify.app` | 730 KB | 4 | "Ceylon Cinnamon \| The Merchant" | Deep-dive product / shop page. |
| `https://serendibauthenticate.netlify.app` | 82 KB | 1 | "Serendib Authenticate \| The Merchant" | "Under construction" authentication portal. Currently directs users to email `contact@the-merchant.us`. |

All three appear to be vanilla static HTML/CSS/JS (no detected framework markers). Typography uses Cormorant Garamond, Crimson Pro, and Cinzel via Google Fonts.

## Architecture

A Next.js 15 (App Router) project, statically exported, deployed to Vercel.

### Route map

| Route | Source HTML | Notes |
|-------|-------------|-------|
| `/` | `the-merchant.us` | Preserves the existing anchor-section layout (`#home`, `#about`, `#for-whom`, `#product`, `#authenticate`, `#faq`, `#contact`). |
| `/shop` | `ceyloncinnoman.netlify.app` | Product page. |
| `/authenticate` | `serendibauthenticate.netlify.app` | Auth portal. |

### Project structure

```
the-merchant/
├── app/
│   ├── layout.tsx            ← shared nav + html shell
│   ├── page.tsx              ← injects home body content
│   ├── shop/
│   │   └── page.tsx          ← injects ceyloncinnoman body content
│   ├── authenticate/
│   │   └── page.tsx          ← injects serendibauthenticate body content
│   └── globals.css           ← shared nav styling only
├── content/
│   ├── home.html             ← extracted <body> innerHTML from the-merchant.us
│   ├── shop.html             ← extracted <body> innerHTML from ceyloncinnoman
│   └── authenticate.html     ← extracted <body> innerHTML from serendibauthenticate
├── public/
│   └── images/
│       ├── home/             ← decoded base64 images from home
│       ├── shop/             ← decoded base64 images from shop
│       └── authenticate/     ← decoded base64 images from authenticate
├── scripts/
│   └── extract.mjs           ← one-time helper that downloads each Netlify site, extracts base64 images, rewrites links, and writes content/*.html + public/images/**
├── docs/
│   └── superpowers/specs/    ← this spec lives here
├── package.json
├── next.config.mjs           ← `output: 'export'`, image optimization disabled (static)
├── tsconfig.json
└── README.md
```

## Asset extraction (the big performance win)

A one-shot script (`scripts/extract.mjs`) handles the transformation. It runs once during initial migration; its outputs are committed to the repo and the script does not run at build time.

For each source URL:

1. `fetch` the live HTML.
2. Parse out every `data:image/{mime};base64,{payload}` URI (in `src=`, `style="background-image:url(...)"`, and `<style>` block references).
3. For each match, decode to a `Buffer`, detect file extension from the MIME type, write to `public/images/{route}/img-{n}.{ext}` where `n` is a stable sequential index.
4. Replace the URI in the HTML with the matching `/images/{route}/img-{n}.{ext}` path.
5. Rewrite cross-site links:
   - `https://the-merchant.us` → `/`
   - `https://ceyloncinnoman.netlify.app` → `/shop`
   - `https://serendibauthenticate.netlify.app` → `/authenticate`
6. Extract just the `<body>` inner HTML plus the original `<style>` blocks from `<head>` (concatenated into the body content so per-page CSS keeps working).
7. Write the result to `content/{route}.html`.

Expected result: the 32 MB merchant HTML compresses to roughly 50 KB of HTML + ~5 MB of properly-cacheable image files. Total transfer drops dramatically and the browser can cache individual assets.

## Page rendering approach

Each route's `page.tsx` reads its corresponding `content/{route}.html` at build time and injects it via `dangerouslySetInnerHTML`:

```tsx
// app/page.tsx
import fs from 'node:fs';
import path from 'node:path';

export default function HomePage() {
  const html = fs.readFileSync(
    path.join(process.cwd(), 'content/home.html'),
    'utf-8'
  );
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
```

Because Next.js is configured for static export (`output: 'export'`), this runs at build time and emits plain static HTML. No runtime server, no React hydration overhead for the preserved content.

The original pages' `<style>` blocks are scoped inside each `<div>` wrapper, so they shouldn't interfere with neighboring page styles (each route is a fully separate HTML document at runtime; cross-route style bleed is not possible).

`dangerouslySetInnerHTML` is acceptable here because: (a) content is checked into git and reviewed by a human before deploy, (b) the source HTML came from the user's own deployed Netlify projects, (c) no user input is ever interpolated into it. The "dangerous" attribute name reflects React's caution, not actual risk in this context.

## Shared navigation

`app/layout.tsx` provides the only piece of new UI: a top bar above every route's content.

```
┌──────────────────────────────────────────────────────────┐
│  THE MERCHANT          Home    Shop    Authenticate      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│         (original page content renders here)             │
│                                                          │
```

- Wordmark left, three links right.
- Font: Cinzel (already loaded by the source pages' Google Fonts links — we re-import it in `layout.tsx`).
- Sticky to top of viewport; minimal height; transparent or near-transparent background so it doesn't fight the hero imagery of the source pages.
- Active route gets a subtle underline.

Total layout CSS: well under 100 lines. No design system, no component library — this is intentionally a thin overlay.

## Stack and dependencies

- **Next.js 15** (App Router, static export mode)
- **React 18**
- **TypeScript** (strict mode)
- **Node 20+** required for build (user is currently on Node 18 — covered under "Prerequisites" below)
- No CSS framework (the source pages bring their own CSS)
- No state management, no client-side data fetching, no auth library

## Prerequisites (one-time setup on the user's machine)

1. **Upgrade Node to v20+.** Currently Node 18, which both Next.js 15 and the Netlify MCP server require to be upgraded. Default: install via NodeSource apt repo on WSL Ubuntu (one-shot, system-wide). If the user prefers per-shell version isolation, fall back to `nvm`.
2. **Install GitHub CLI (`gh`).** Not currently present. Install via the official apt repo (Ubuntu/WSL).
3. **Authenticate `gh`.** `gh auth login` → web flow.
4. **Vercel CLI is optional** — the user already has Vercel MCP access, and we can connect the Vercel project to the GitHub repo through the Vercel dashboard. CLI not required.

## Deploy flow

1. `npm install` (project dependencies).
2. `npm run extract` (runs `scripts/extract.mjs` — downloads from Netlify, extracts assets, writes `content/` and `public/images/`).
3. `npm run dev` — local smoke test of all 3 routes.
4. `npm run build` — produces static export under `out/`. Verify no errors.
5. `git init`, initial commit.
6. `gh repo create the-merchant --public --source=. --remote=origin --push`.
7. In Vercel dashboard: New Project → Import from GitHub → select `the-merchant` repo → defaults are correct for Next.js → Deploy.
8. Vercel returns a `*.vercel.app` URL. Confirm all three routes render correctly. Done.

DNS changes for `the-merchant.us` are explicitly deferred to a later session.

## Verification checklist (post-deploy)

- [ ] `/` renders, all 7 anchor sections (`#home` through `#contact`) reachable.
- [ ] `/shop` renders, product imagery loads.
- [ ] `/authenticate` renders, contact email link works.
- [ ] All in-page anchor links (`#about` etc.) scroll correctly on home page.
- [ ] All cross-site links go to internal routes, not the old Netlify URLs.
- [ ] All images load (no broken `data:` references left over, no 404s on `/images/...`).
- [ ] Google Fonts load on all three pages.
- [ ] Shared nav appears on all three routes and links work.
- [ ] Total page weight for `/` is < 6 MB (down from 32 MB).
- [ ] Lighthouse "Performance" score on `/` improves substantially vs. the current Netlify deploy.

## Risks and open questions

- **Source HTML CSS conflicts inside a single React tree.** The original pages use selectors like `body { ... }` and global resets. When we inject them inside a `<div>` of a Next.js page, those body-targeted rules won't behave the same. Mitigation: each route is its own HTML document at build time (static export), so global selectors still target the route's own body. Verify during local dev.
- **JavaScript in the source pages.** If any of the three pages have inline `<script>` tags, `dangerouslySetInnerHTML` will inject them as text — they will NOT execute. We need to detect inline scripts during extraction and either (a) move them into Next.js `<Script>` components, or (b) keep the page as a raw HTML file in `public/` and serve via a rewrite. Inspect during execution; decide per-page.
- **Anchor links to other routes.** If `the-merchant.us` `#product` link is meant to take you to the `/shop` page rather than scroll to the home page's product section, the user needs to clarify. Default: leave anchors as in-page scrolls (current behavior).
- **Forms.** If any source page uses Netlify Forms (`data-netlify="true"`), those won't work on Vercel. The under-construction Serendib page seems to use mailto/email, not forms. Worth a grep during extraction.
- **Repo name conflict.** If the user already has a `the-merchant` repo on GitHub, `gh repo create` will fail. We'll fall back to a name like `the-merchant-site`.

## Decisions captured

- **Migration approach:** Static cleanup (extract base64 images, add shared nav, rewrite cross-links, preserve original designs). Chosen over minimal port (no asset optimization) and full Next.js rebuild (too large for one session).
- **Layout:** Single Vercel project, pages on routes (`/`, `/shop`, `/authenticate`).
- **Source code:** Reconstructed from live Netlify HTML (no source repo exists).
- **GitHub:** Install `gh` CLI, log in, create new repo (default name `the-merchant`).
- **Domain:** Deferred. Use `*.vercel.app` URL initially. DNS switch happens later.
- **Content overlap:** Home page keeps its `#product` and `#authenticate` sections as-is, even though `/shop` and `/authenticate` routes exist. No content stripping.
