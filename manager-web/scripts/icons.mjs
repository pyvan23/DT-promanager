// Generates the PWA icons from an original SVG emblem (a pitch with a ball, in the app's colours).
// Run: node scripts/icons.mjs  (writes public/icons/* and public/favicon.svg)
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const NAVY = '#0a1220';
const GRASS = '#1f6b3d';
const GRASS_DARK = '#17512e';
const CHALK = '#f4f1e8';
const RED = '#d7263d';
const GOLD = '#f5b942';

/** The emblem drawn on a 512 box; `pad` shrinks it toward the centre (maskable safe zone). */
function emblem({ pad = 0, round = true } = {}) {
  const s = 512;
  const inner = s - pad * 2;
  const k = inner / 512;
  const t = (v) => pad + v * k;
  // Ball: a white disc with a central pentagon and five spokes.
  const cx = t(256), cy = t(256), r = 92 * k;
  const pent = Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * (Math.PI / 180);
    return [cx + Math.cos(a) * r * 0.42, cy + Math.sin(a) * r * 0.42];
  });
  const spokes = pent
    .map(([x, y]) => {
      const dx = x - cx, dy = y - cy;
      return `<line x1="${x}" y1="${y}" x2="${cx + dx * 2.35}" y2="${cy + dy * 2.35}" />`;
    })
    .join('');
  const stripes = Array.from({ length: 6 }, (_, i) =>
    i % 2 ? `<rect x="${t(64 + i * 64)}" y="${t(64)}" width="${64 * k}" height="${384 * k}" fill="${GRASS_DARK}" />` : '',
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${s} ${s}" width="${s}" height="${s}">
  <defs><clipPath id="pitch"><rect x="${t(64)}" y="${t(64)}" width="${384 * k}" height="${384 * k}" rx="${28 * k}" /></clipPath></defs>
  <rect width="${s}" height="${s}" rx="${round ? 96 : 0}" fill="${NAVY}" />
  <rect x="${t(64)}" y="${t(64)}" width="${384 * k}" height="${384 * k}" rx="${28 * k}" fill="${GRASS}" />
  <g clip-path="url(#pitch)">${stripes}</g>
  <g fill="none" stroke="${CHALK}" stroke-width="${10 * k}" stroke-opacity="0.9">
    <rect x="${t(84)}" y="${t(84)}" width="${344 * k}" height="${344 * k}" rx="${8 * k}" />
    <line x1="${t(84)}" y1="${t(256)}" x2="${t(428)}" y2="${t(256)}" />
    <circle cx="${cx}" cy="${cy}" r="${128 * k}" />
  </g>
  <rect x="${t(64)}" y="${t(64)}" width="${384 * k}" height="${384 * k}" rx="${28 * k}" fill="none" stroke="${RED}" stroke-width="${8 * k}" />
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="${NAVY}" stroke-width="${8 * k}" />
  <g stroke="${NAVY}" stroke-width="${7 * k}" stroke-linecap="round">${spokes}</g>
  <polygon points="${pent.map((p) => p.join(',')).join(' ')}" fill="${NAVY}" />
  <circle cx="${t(404)}" cy="${t(108)}" r="${18 * k}" fill="${GOLD}" />
</svg>`;
}

mkdirSync('public/icons', { recursive: true });
const plain = emblem();
const full = emblem({ round: false }); // iOS rounds the corners itself
const maskable = emblem({ pad: 44, round: false }); // keeps the art inside the 80% safe zone

writeFileSync('public/favicon.svg', plain);
const out = [
  [plain, 'public/icons/icon-192.png', 192],
  [plain, 'public/icons/icon-512.png', 512],
  [maskable, 'public/icons/icon-maskable-512.png', 512],
  [full, 'public/icons/apple-touch-icon.png', 180],
  [plain, 'public/icons/favicon-32.png', 32],
];
for (const [svg, file, size] of out) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log('wrote', file);
}
