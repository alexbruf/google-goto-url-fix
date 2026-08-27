#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const root = path.join(__dirname, "..");
const output = path.join(root, "icons");
fs.mkdirSync(output, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const result = Buffer.alloc(data.length + 12);
  result.writeUInt32BE(data.length, 0);
  name.copy(result, 4);
  data.copy(result, 8);
  result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8);
  return result;
}

function roundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.max(left + radius, Math.min(x, right - radius));
  const cy = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

function segmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pixelAt(x, y, size) {
  const scale = size / 128;
  const px = (x + 0.5) / scale;
  const py = (y + 0.5) / scale;
  const inside = roundedRect(px, py, 16, 16, 112, 112, 24);
  if (!inside) return [0, 0, 0, 0];

  let white = segmentDistance(px, py, 47, 64, 81, 64) <= 5.5;
  const rings = [
    { cx: 41, cy: 64, start: Math.PI / 2, end: Math.PI * 1.5 },
    { cx: 87, cy: 64, start: -Math.PI / 2, end: Math.PI / 2 }
  ];
  for (const ring of rings) {
    const distance = Math.abs(Math.hypot(px - ring.cx, py - ring.cy) - 20);
    const angle = Math.atan2(py - ring.cy, px - ring.cx);
    const side = ring.cx < 64 ? Math.cos(angle) <= 0.72 : Math.cos(angle) >= -0.72;
    white ||= distance <= 5.5 && side;
  }
  return white ? [255, 255, 255, 255] : [26, 115, 232, 255];
}

function createPng(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = y * stride + 1 + x * 4;
      Buffer.from(pixelAt(x, y, size)).copy(raw, offset);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

for (const size of [16, 32, 48, 64, 96, 128, 256, 512]) {
  fs.writeFileSync(path.join(output, `icon-${size}.png`), createPng(size));
}
