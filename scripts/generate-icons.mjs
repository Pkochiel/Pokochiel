/**
 * PWA アイコンを生成する。
 *
 * 図案は src/app/icon.svg と同じ（ネイビーの角丸に本文の行、注視中の 1 行を琥珀色）。
 * PNG は依存を足さずに書き出す（node:zlib だけで完結する）。
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SUPERSAMPLE = 4

const NAVY = [0x16, 0x23, 0x3d]
const PAPER = [0xf4, 0xf6, 0xfa]
const AMBER = [0xd9, 0x7a, 0x1e]

/** 図案（0..1 の相対座標）。SVG と同じ値を使う。 */
const CORNER_RADIUS = 0.22
const BAR_X = 0.23
const BAR_HEIGHT = 0.07
const BAR_GAP = 0.075
const BARS = [
  { width: 0.54, color: PAPER, alpha: 0.94 },
  { width: 0.4, color: AMBER, alpha: 1 },
  { width: 0.5, color: PAPER, alpha: 0.94 },
  { width: 0.28, color: PAPER, alpha: 0.5 },
]

function insideRoundedRect(x, y, x0, y0, x1, y1, radius) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + radius), x1 - radius)
  const cy = Math.min(Math.max(y, y0 + radius), y1 - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

function paint(x, y) {
  let pixel = [0, 0, 0, 0]
  const blend = (color, alpha) => {
    pixel = [
      color[0] * alpha + pixel[0] * (1 - alpha),
      color[1] * alpha + pixel[1] * (1 - alpha),
      color[2] * alpha + pixel[2] * (1 - alpha),
      alpha + pixel[3] * (1 - alpha),
    ]
  }

  if (insideRoundedRect(x, y, 0, 0, 1, 1, CORNER_RADIUS)) blend(NAVY, 1)

  const total = BARS.length * BAR_HEIGHT + (BARS.length - 1) * BAR_GAP
  let top = (1 - total) / 2
  for (const bar of BARS) {
    if (insideRoundedRect(x, y, BAR_X, top, BAR_X + bar.width, top + BAR_HEIGHT, BAR_HEIGHT / 2)) {
      blend(bar.color, bar.alpha)
    }
    top += BAR_HEIGHT + BAR_GAP
  }
  return pixel
}

function render(size) {
  const high = size * SUPERSAMPLE
  const samples = new Float64Array(high * high * 4)
  for (let py = 0; py < high; py += 1) {
    for (let px = 0; px < high; px += 1) {
      const [r, g, b, a] = paint((px + 0.5) / high, (py + 0.5) / high)
      const at = (py * high + px) * 4
      samples[at] = r
      samples[at + 1] = g
      samples[at + 2] = b
      samples[at + 3] = a
    }
  }

  const rgba = Buffer.alloc(size * size * 4)
  const perPixel = SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const sum = [0, 0, 0, 0]
      for (let sy = 0; sy < SUPERSAMPLE; sy += 1) {
        for (let sx = 0; sx < SUPERSAMPLE; sx += 1) {
          const at = ((y * SUPERSAMPLE + sy) * high + (x * SUPERSAMPLE + sx)) * 4
          sum[0] += samples[at]
          sum[1] += samples[at + 1]
          sum[2] += samples[at + 2]
          sum[3] += samples[at + 3]
        }
      }
      const at = (y * size + x) * 4
      rgba[at] = Math.round(sum[0] / perPixel)
      rgba[at + 1] = Math.round(sum[1] / perPixel)
      rgba[at + 2] = Math.round(sum[2] / perPixel)
      rgba[at + 3] = Math.round((sum[3] / perPixel) * 255)
    }
  }
  return rgba
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(size, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8 // bit depth
  header[9] = 6 // color type: RGBA
  const scanlines = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y += 1) {
    scanlines[y * (size * 4 + 1)] = 0 // filter: none
    rgba.copy(scanlines, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(scanlines, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const TARGETS = [
  { size: 192, path: 'public/icon-192.png' },
  { size: 512, path: 'public/icon-512.png' },
  { size: 180, path: 'src/app/apple-icon.png' },
]

for (const target of TARGETS) {
  const file = join(ROOT, target.path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, encodePng(target.size, render(target.size)))
  console.log(`generated ${target.path} (${target.size}px)`)
}
