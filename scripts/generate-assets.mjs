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
