// Compares two screenshot trees pixel by pixel, so "no visual change" can be asserted
// rather than eyeballed. Byte comparison is useless here: the ambient background and
// spring animations settle slightly differently on every run.
// Usage: node scripts/screenshot-diff.mjs <baseDir> <headDir> [--threshold 0.5]
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import sharp from 'sharp'

const [base, head] = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const thresholdIndex = process.argv.indexOf('--threshold')
/** Percent of pixels allowed to differ before a screen counts as changed. */
const THRESHOLD = thresholdIndex === -1 ? 0.5 : Number(process.argv[thresholdIndex + 1])
/** Per-channel sum below which a pixel is considered unchanged (anti-aliasing, gradient dither). */
const PIXEL_TOLERANCE = 12

if (!base || !head) {
  console.error('usage: node scripts/screenshot-diff.mjs <baseDir> <headDir> [--threshold 0.5]')
  process.exit(1)
}

const files = []
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) walk(path)
    else if (path.endsWith('.png')) files.push(relative(base, path))
  }
}
walk(base)
files.sort()

const changed = []
let missing = 0

for (const file of files) {
  const headPath = join(head, file)
  if (!existsSync(headPath)) {
    console.log(`missing   ${file}`)
    missing++
    continue
  }
  const [a, b] = await Promise.all(
    [join(base, file), headPath].map((p) => sharp(p).raw().ensureAlpha().toBuffer({ resolveWithObject: true })),
  )
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) {
    console.log(`resized   ${file}  ${a.info.width}x${a.info.height} → ${b.info.width}x${b.info.height}`)
    changed.push(file)
    continue
  }
  let differing = 0
  for (let i = 0; i < a.data.length; i += 4) {
    const delta =
      Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])
    if (delta > PIXEL_TOLERANCE) differing++
  }
  const percent = (differing / (a.data.length / 4)) * 100
  const over = percent > THRESHOLD
  if (over) changed.push(file)
  console.log(`${over ? 'CHANGED  ' : 'ok       '} ${file.padEnd(30)} ${percent.toFixed(3)}%`)
}

console.log(`\n${files.length} screens, ${changed.length} changed, ${missing} missing (threshold ${THRESHOLD}%)`)
process.exit(changed.length > 0 || missing > 0 ? 1 : 0)
