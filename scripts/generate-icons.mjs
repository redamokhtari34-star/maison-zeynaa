/**
 * Renders the app icons from the house monogram.
 *
 * The icons shipped before were three copies of the same 1 MB photo, which is
 * both heavy and wrong at small sizes. These are drawn at the exact size they
 * are declared at, and the maskable variant keeps the monogram inside the
 * safe zone so Android's circular mask never clips it.
 *
 *   node scripts/generate-icons.mjs
 */
import { chromium } from 'playwright-core';
import { writeFileSync } from 'fs';

const OUT = new URL('../public/', import.meta.url).pathname;

// Android may crop a maskable icon to a circle of ~80% of the canvas, so the
// artwork is drawn smaller inside a full-bleed background.
const TARGETS = [
  { file: 'icon-192.png', size: 192, scale: 0.82, radius: 0.22 },
  { file: 'icon-512.png', size: 512, scale: 0.82, radius: 0.22 },
  { file: 'apple-touch-icon.png', size: 180, scale: 0.86, radius: 0.0 },
  { file: 'maskable-icon-512.png', size: 512, scale: 0.62, radius: 0.0 },
];

const page = (size, scale, radius) => `<!doctype html>
<meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600&display=swap');
  html,body{margin:0;padding:0}
  body{width:${size}px;height:${size}px;background:#FAF9F7;display:grid;place-items:center}
  .tile{
    width:${Math.round(size * scale)}px;height:${Math.round(size * scale)}px;
    background:#121110;border-radius:${Math.round(size * radius)}px;
    display:grid;place-items:center;
  }
  .mono{
    font-family:'Playfair Display',Georgia,serif;font-weight:600;color:#FAF9F7;
    font-size:${Math.round(size * scale * 0.42)}px;letter-spacing:0.02em;line-height:1;
  }
</style>
<div class="tile"><span class="mono">MZ</span></div>`;

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const { file, size, scale, radius } of TARGETS) {
  const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(page(size, scale, radius), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const buf = await p.screenshot({ omitBackground: false });
  writeFileSync(OUT + file, buf);
  console.log(`  ${file.padEnd(24)} ${size}×${size}  ${(buf.length / 1024).toFixed(1)} KB`);
  await p.close();
}
await browser.close();
