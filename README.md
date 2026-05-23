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
`dangerouslySetInnerHTML`, stripping inline `<script>` blocks and re-adding
them via `next/script` so interactive features (FAQ accordion, scroll
reveals, sticky nav) still work. A `layout.tsx` adds the shared top nav.

The original page designs are preserved verbatim; only the navigation and
asset paths change.
