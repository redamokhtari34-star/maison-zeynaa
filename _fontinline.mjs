/* Fetch the Nunito latin subsets and emit @font-face rules with the woff2
 * payload embedded as data: URIs. The artifact CSP blocks font CDNs, so the
 * preview would silently fall back to a system face without this. */
import { writeFileSync } from 'fs';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
const css = await (await fetch(
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap',
  { headers: { 'User-Agent': UA } }
)).text();

// Latin only — it covers the French accents; latin-ext (Eastern European) and
// Cyrillic would double the payload for glyphs this app never renders, and the
// Arabic UI text is served by the system face either way.
const blocks = css.split('/*').filter(b => /^\s*latin\s*\*\//.test(b));
if (!blocks.length) throw new Error('no latin blocks found');

let out = '';
for (const b of blocks) {
  const weight = b.match(/font-weight:\s*(\d+)/)?.[1];
  const url = b.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  const range = b.match(/unicode-range:\s*([^;]+);/)?.[1];
  if (!weight || !url) continue;
  const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
  out += `@font-face{font-family:'Nunito';font-style:normal;font-weight:${weight};font-display:swap;` +
         `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2');` +
         (range ? `unicode-range:${range};` : '') + `}\n`;
  console.error(`  Nunito ${weight} (${b.match(/^\s*(\S+)/)[1]}): ${(buf.length / 1024).toFixed(1)} KB`);
}

writeFileSync(process.argv[2], out);
console.error(`Wrote ${process.argv[2]} (${(out.length / 1024).toFixed(0)} KB base64)`);
