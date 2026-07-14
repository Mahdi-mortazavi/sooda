// Renders the app icon SVG into all PWA/touch icon PNGs + favicon.
// Run: node scripts/generate-assets.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pub = join(root, 'public')
await mkdir(pub, { recursive: true })

const iconSvg = await readFile(join(root, 'scripts', 'icon.svg'))

// Regular icons: full artwork.
for (const size of [192, 512]) {
  await sharp(iconSvg).resize(size, size).png().toFile(join(pub, `pwa-${size}x${size}.png`))
}

// Maskable icons: artwork shrunk into the ~80% safe zone over a solid brand background.
for (const size of [192, 512]) {
  const inner = Math.round(size * 0.78)
  const art = await sharp(iconSvg).resize(inner, inner).png().toBuffer()
  await sharp({
    create: { width: size, height: size, channels: 4, background: '#0f7a5f' },
  })
    .composite([{ input: art, gravity: 'center' }])
    .png()
    .toFile(join(pub, `pwa-maskable-${size}x${size}.png`))
}

// Apple touch icon: 180px, opaque.
await sharp(iconSvg).resize(180, 180).flatten({ background: '#0f7a5f' }).png().toFile(join(pub, 'apple-touch-icon.png'))

// Favicon: ship the SVG itself.
await writeFile(join(pub, 'favicon.svg'), iconSvg)

console.log('✓ icons generated in public/')

// Home-screen shortcut icons: brand gradient tile + white glyph.
const GLYPHS = {
  profit: `<path d="M156 100 L100 156" stroke="#fff" stroke-width="13" stroke-linecap="round"/>
    <circle cx="103" cy="103" r="14" fill="none" stroke="#fff" stroke-width="13"/>
    <circle cx="153" cy="153" r="14" fill="none" stroke="#fff" stroke-width="13"/>`,
  sell: `<g stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M96 172h64M128 84v88M128 84l-30 15M128 84l30 15"/>
    <path d="M83 133 98 96l15 37a15 15 0 0 1-30 0ZM143 133 158 96l15 37a15 15 0 0 1-30 0Z"/></g>`,
  discount: `<g stroke="#fff" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M84 133V95a9 9 0 0 1 9-9h38a11 11 0 0 1 8 3l34 34a11 11 0 0 1 0 15l-32 32a11 11 0 0 1-15 0l-39-39a9 9 0 0 1-3-8Z"/>
    <circle cx="109" cy="111" r="7" fill="#fff" stroke="none"/></g>`,
}
for (const [key, glyph] of Object.entries(GLYPHS)) {
  const svg = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0e5b4a"/><stop offset="0.5" stop-color="#0f7a5f"/><stop offset="1" stop-color="#16a37e"/>
    </linearGradient></defs>
    <rect width="256" height="256" rx="58" fill="url(#g)"/>${glyph}</svg>`
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(join(pub, `shortcut-${key}.png`))
}
console.log('✓ shortcut icons generated')
