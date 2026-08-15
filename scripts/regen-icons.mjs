#!/usr/bin/env node
// Regenerate raster brand icons from the SVG sources in public/.
//
//   node scripts/regen-icons.mjs
//
// Produces:
//   public/sahha-logo.png          transparent mint "5" glyph mark, matches current dims
//   public/brand-mark.png          transparent brand mark, matches current dims
//   public/pwa-192x192.png         app tile 192x192
//   public/pwa-512x512.png         app tile 512x512 (also serves the maskable purpose:
//                                  bg fills the canvas, glyph stays in the 80% safe zone)
//   public/apple-touch-icon.png    app tile 180x180
//   public/pwa-maskable-512x512.png tile scaled to the 80% safe zone on #05070c
//
// The <link rel="icon">/mask-icon in index.html resolve through /pwa-192x192.png,
// so no favicon.ico is emitted.
//
// Repeatable: dimensions for the marks are read from the current PNGs so a rerun
// matches whatever the working tree has.

import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = resolve(root, 'public');

const BG = '#05070c'; // canonical background
const MINT = '#7ee0b0'; // mint-sage accent
const GLYPH_FONT = "Amiri, 'Noto Naskh Arabic', serif";
const MASKABLE_SAFE = 0.8; // safe-zone fraction for maskable icons

const sahhaSvg = readFileSync(resolve(publicDir, 'sahha.svg'), 'utf8');
const brandMarkSvg = readFileSync(resolve(publicDir, 'brand-mark.svg'), 'utf8');

// Transparent glyph-only variant of the tile, used for the inline brand mark.
const glyphSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <text x="256" y="376" text-anchor="middle" font-family="${GLYPH_FONT}" font-size="360" font-weight="700" fill="${MINT}">5</text>
</svg>`;

async function render(svg, outFile, { width, height, fit }) {
  await sharp(Buffer.from(svg))
    .resize(width, height, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(outFile);
  const m = await sharp(outFile).metadata();
  console.log(`  ${resolve(publicDir, outFile)} -> ${m.width}x${m.height}`);
}

async function main() {
  console.log('Regenerating raster icons from public/*.svg');

  // Marks: square canvas (natural viewBox aspect) so they render at the
  // correct square aspect beside the wordmark — no letterbox side margins.
  await render(glyphSvg, resolve(publicDir, 'sahha-logo.png'), {
    width: 512, height: 512, fit: 'fill',
  });
  await render(brandMarkSvg, resolve(publicDir, 'brand-mark.png'), {
    width: 512, height: 512, fit: 'fill',
  });

  // App tiles (square source -> square target, no distortion).
  await render(sahhaSvg, resolve(publicDir, 'pwa-192x192.png'), { width: 192, height: 192, fit: 'fill' });
  await render(sahhaSvg, resolve(publicDir, 'pwa-512x512.png'), { width: 512, height: 512, fit: 'fill' });
  await render(sahhaSvg, resolve(publicDir, 'apple-touch-icon.png'), { width: 180, height: 180, fit: 'fill' });

  // Explicit maskable variant: tile scaled to the safe zone on a full-bleed BG canvas.
  const tile = Math.round(512 * MASKABLE_SAFE);
  const maskableOut = resolve(publicDir, 'pwa-maskable-512x512.png');
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: { r: 5, g: 7, b: 12, alpha: 1 } },
  })
    .composite([
      { input: await sharp(Buffer.from(sahhaSvg)).resize(tile, tile, { fit: 'fill' }).png().toBuffer() },
    ])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(maskableOut);
  console.log(`  ${maskableOut} -> 512x512 (tile at ${MASKABLE_SAFE * 100}% safe zone)`);

  console.log('Done. favicon.ico not emitted: index.html resolves the favicon via /pwa-192x192.png.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
