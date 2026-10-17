// Gera os ícones do PWA a partir do desenho do logo (mesmos traços de src/app/icon.svg).
// Uso: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp';

const BRAND = '#6d4aff';

// Letra "D" e o ponto do logo, no sistema de 32x32 do icon.svg (centro aproximado em 17,5 / 16).
const glyph = `
  <path d="M10 9h6.5a7 7 0 0 1 0 14H10z" fill="none" stroke="#fff" stroke-width="3" stroke-linejoin="round"/>
  <circle cx="23.5" cy="9.5" r="2.2" fill="#9be8df"/>`;

/** Ícone "any": quadrado arredondado, igual ao logo. */
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="10" fill="${BRAND}"/>${glyph}</svg>`;

/** Sem cantos e com o logo menor no centro: o Android e o iOS recortam o formato por conta própria. */
const fullBleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${BRAND}"/>
  <g transform="translate(16 16) scale(${scale}) translate(-17.5 -16)">${glyph}</g></svg>`;

const jobs = [
  ['public/icons/icon-192.png', rounded, 192],
  ['public/icons/icon-512.png', rounded, 512],
  ['public/icons/icon-maskable-512.png', fullBleed(0.9), 512], // zona segura de 80%
  ['src/app/apple-icon.png', fullBleed(1.05), 180],
];

for (const [file, svg, size] of jobs) {
  await sharp(Buffer.from(svg), { density: 600 }).resize(size, size).png().toFile(file);
  console.log('gerado', file, `${size}x${size}`);
}
