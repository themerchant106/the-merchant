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
