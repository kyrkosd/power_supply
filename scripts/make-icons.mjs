// Pure Node.js — no extra dependencies.
// Generates resources/icon.png (512×512 lightning bolt on dark bg)
// and resources/icon.svg.
// Usage: node scripts/make-icons.mjs

/* global Uint8Array, Int32Array, Buffer, console */

import { deflateSync } from 'zlib'
import { writeFileSync, mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dir, '..', 'resources')
mkdirSync(outDir, { recursive: true })

// ── SVG ───────────────────────────────────────────────────────────────────
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0f1928"/>
  <polygon points="296,48 148,288 248,288 152,464 376,216 272,216 370,48"
    fill="#ffc400" stroke="#fff" stroke-width="6" stroke-linejoin="round"/>
</svg>`
writeFileSync(join(outDir, 'icon.svg'), svg)
console.log('✓  resources/icon.svg')

// ── PNG ───────────────────────────────────────────────────────────────────
const SIZE = 512
const rgb = new Uint8Array(SIZE * SIZE * 3)

// Background: #0f1928
for (let i = 0; i < SIZE * SIZE; i++) {
  rgb[i * 3] = 0x0f; rgb[i * 3 + 1] = 0x19; rgb[i * 3 + 2] = 0x28
}

// Rounded-rect mask: clear corners to transparent (use alpha)
const rgba = new Uint8Array(SIZE * SIZE * 4)
const R = 96 // corner radius
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // corner distance
    const cx = x < R ? R - x : x > SIZE - R - 1 ? x - (SIZE - R - 1) : 0
    const cy = y < R ? R - y : y > SIZE - R - 1 ? y - (SIZE - R - 1) : 0
    const inside = Math.sqrt(cx * cx + cy * cy) < R
    const a = (cx === 0 && cy === 0) ? 255 : inside ? 255 : 0
    const i4 = (y * SIZE + x) * 4
    const i3 = (y * SIZE + x) * 3
    rgba[i4] = rgb[i3]; rgba[i4 + 1] = rgb[i3 + 1]; rgba[i4 + 2] = rgb[i3 + 2]; rgba[i4 + 3] = a
  }
}

// Lightning bolt polygon (scaled to 512×512)
// Points from SVG: 296,48 148,288 248,288 152,464 376,216 272,216 370,48
const bolt = [[296,48],[148,288],[248,288],[152,464],[376,216],[272,216],[370,48]]

function inPoly(px, py, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
      inside = !inside
  }
  return inside
}

// Fill bolt gold: #ffc400
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    if (inPoly(x, y, bolt)) {
      const i4 = (y * SIZE + x) * 4
      rgba[i4] = 0xff; rgba[i4 + 1] = 0xc4; rgba[i4 + 2] = 0x00; rgba[i4 + 3] = 255
    }
  }
}

// CRC32 table
const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
  CRC_TABLE[n] = c
}
function crc32(buf) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

function makeChunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const d = data instanceof Buffer ? data : Buffer.from(data)
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(d.length, 0)
  const crcInput = Buffer.concat([t, d])
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lenBuf, t, d, crcBuf])
}

// Build RGBA scanlines with filter-none bytes
const scanlines = Buffer.allocUnsafe(SIZE * (SIZE * 4 + 1))
for (let y = 0; y < SIZE; y++) {
  scanlines[y * (SIZE * 4 + 1)] = 0 // filter: None
  for (let x = 0; x < SIZE; x++) {
    const src = (y * SIZE + x) * 4
    const dst = y * (SIZE * 4 + 1) + 1 + x * 4
    scanlines[dst]   = rgba[src]
    scanlines[dst+1] = rgba[src+1]
    scanlines[dst+2] = rgba[src+2]
    scanlines[dst+3] = rgba[src+3]
  }
}
const idat = deflateSync(scanlines, { level: 6 })

const ihdr = Buffer.allocUnsafe(13)
ihdr.writeUInt32BE(SIZE, 0)
ihdr.writeUInt32BE(SIZE, 4)
ihdr[8] = 8   // bit depth
ihdr[9] = 6   // color type: RGBA
ihdr[10] = ihdr[11] = ihdr[12] = 0

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  makeChunk('IHDR', ihdr),
  makeChunk('IDAT', idat),
  makeChunk('IEND', Buffer.alloc(0)),
])
writeFileSync(join(outDir, 'icon.png'), png)
console.log('✓  resources/icon.png')
console.log('Done — run "npm run build" to package.')
