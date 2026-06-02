// Rasterize the editorial SVG brand assets into the PNG icons crawlers,
// Safari, and PWAs need. SVG favicons cover modern browsers, but
// apple-touch-icon, the manifest icons, and (most importantly) the Open Graph
// image must be real PNGs — many social/crawler renderers ignore SVG OG images.
//
// Run:  node scripts/gen-icons.mjs        (regenerate all assets)
//       node scripts/gen-icons.mjs --preview   (also emit large previews)
//
// `sharp` ships transitively in node_modules; no extra install needed.

import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const pub = (p) => resolve(root, 'public', p)

async function render(svgPath, outPath, size, { density = 384 } = {}) {
  const svg = await readFile(svgPath)
  await sharp(svg, { density })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath)
  console.log(`  ${outPath.replace(root + '\\', '').replace(root + '/', '')}  ${size}×${size}`)
}

async function renderRect(svgPath, outPath, w, h, { density = 192 } = {}) {
  const svg = await readFile(svgPath)
  await sharp(svg, { density }).resize(w, h, { fit: 'fill' }).png().toFile(outPath)
  console.log(`  ${outPath.replace(root + '\\', '').replace(root + '/', '')}  ${w}×${h}`)
}

const preview = process.argv.includes('--preview')

console.log('Icons:')
await render(pub('favicon.svg'), pub('favicon-32.png'), 32)
await render(pub('favicon.svg'), pub('favicon-16.png'), 16)
await render(pub('favicon.svg'), pub('apple-touch-icon.png'), 180)
await render(pub('favicon.svg'), pub('icon-192.png'), 192)
await render(pub('favicon.svg'), pub('icon-512.png'), 512)
await render(pub('icon-maskable.svg'), pub('icon-maskable-512.png'), 512)

console.log('Open Graph:')
await renderRect(pub('og.svg'), pub('og.png'), 1200, 630)
await renderRect(pub('og-dark.svg'), pub('og-dark.png'), 1200, 630)

if (preview) {
  console.log('Previews:')
  await render(pub('favicon.svg'), pub('_preview-favicon-256.png'), 256)
  await render(pub('favicon.svg'), pub('_preview-favicon-16.png'), 16)
  await render(pub('icon-maskable.svg'), pub('_preview-maskable-256.png'), 256)
}

console.log('Done.')
