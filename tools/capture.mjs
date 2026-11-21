// Screenshot capture tool using Playwright Chromium.
// Serves game/ over http://127.0.0.1:8099, drives window.__harbor deterministic hooks,
// captures 1280x720 PNG screenshots, quantises to 8-bit palette PNGs to stay well under
// the 256 KiB gate limit, and writes screenshots/1-cover.png .. 4-mission.png.

import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

// Load playwright from tools directory
import { chromium } from '/root/work/gta6/tools/node_modules/playwright/index.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = resolve(here, '..');
const gameDir = join(repoRoot, 'game');
const screenshotsDir = join(repoRoot, 'screenshots');
const PORT = 8099;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// 1. Static HTTP server for game/
function startServer() {
  return new Promise((resolveReady) => {
    const server = createServer((req, res) => {
      let pathname = req.url ? new URL(req.url, 'http://localhost').pathname : '/';
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(gameDir, normalize(pathname)));
      if (!file.startsWith(gameDir + sep) && file !== gameDir) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const st = statSync(file);
        if (!st.isFile()) throw new Error('not file');
        res.writeHead(200, {
          'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream',
          'content-length': st.size,
          'cache-control': 'no-store',
        });
        createReadStream(file).pipe(res);
      } catch {
        res.writeHead(404).end('not found');
      }
    });

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`Server running at http://127.0.0.1:${PORT}`);
      resolveReady(server);
    });
  });
}

// 2. PNG decoder for truecolor RGB images
function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function decodePngRgb(buf) {
  let pos = 8;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.subarray(pos + 4, pos + 8).toString('ascii');
    if (type === 'IDAT') idat.push(buf.subarray(pos + 8, pos + 8 + len));
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const w = 1280;
  const h = 720;
  const bpp = 3;
  const stride = 1 + w * bpp;
  const rgb = new Uint8Array(w * h * 3);

  let prevRow = null;
  for (let y = 0; y < h; y += 1) {
    const filter = raw[y * stride];
    const row = raw.subarray(y * stride + 1, (y + 1) * stride);
    const decodedRow = new Uint8Array(w * bpp);
    for (let i = 0; i < w * bpp; i += 1) {
      const a = i >= bpp ? decodedRow[i - bpp] : 0;
      const b = prevRow ? prevRow[i] : 0;
      const c = prevRow && i >= bpp ? prevRow[i - bpp] : 0;
      let val = row[i];
      if (filter === 1) val = (val + a) & 0xff;
      else if (filter === 2) val = (val + b) & 0xff;
      else if (filter === 3) val = (val + Math.floor((a + b) / 2)) & 0xff;
      else if (filter === 4) val = (val + paethPredictor(a, b, c)) & 0xff;
      decodedRow[i] = val;
    }
    rgb.set(decodedRow, y * w * 3);
    prevRow = decodedRow;
  }
  return rgb;
}

// 3. Fast median-cut palette quantizer (samples pixels to produce 256 colors)
function quantizeMedianCut(rgb, maxColors = 256) {
  const totalPixels = rgb.length / 3;
  const sampleStep = 4;
  const sampled = [];
  for (let i = 0; i < totalPixels; i += sampleStep) {
    sampled.push([rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]]);
  }

  const boxes = [sampled];
  while (boxes.length < maxColors) {
    let bestIdx = -1;
    let bestRange = -1;
    let bestAxis = 0;
    for (let bi = 0; bi < boxes.length; bi += 1) {
      const b = boxes[bi];
      if (b.length <= 1) continue;
      let minR = 255;
      let maxR = 0;
      let minG = 255;
      let maxG = 0;
      let minB = 255;
      let maxB = 0;
      for (const p of b) {
        if (p[0] < minR) minR = p[0];
        if (p[0] > maxR) maxR = p[0];
        if (p[1] < minG) minG = p[1];
        if (p[1] > maxG) maxG = p[1];
        if (p[2] < minB) minB = p[2];
        if (p[2] > maxB) maxB = p[2];
      }
      const rRange = maxR - minR;
      const gRange = maxG - minG;
      const bRange = maxB - minB;
      const mRange = Math.max(rRange, gRange, bRange);
      if (mRange > bestRange) {
        bestRange = mRange;
        bestIdx = bi;
        bestAxis = rRange >= gRange && rRange >= bRange ? 0 : gRange >= bRange ? 1 : 2;
      }
    }
    if (bestIdx === -1 || bestRange === 0) break;
    const targetBox = boxes[bestIdx];
    targetBox.sort((p1, p2) => p1[bestAxis] - p2[bestAxis]);
    const mid = targetBox.length >> 1;
    boxes.splice(bestIdx, 1, targetBox.slice(0, mid), targetBox.slice(mid));
  }

  const palette = [];
  for (const b of boxes) {
    let r = 0;
    let g = 0;
    let bl = 0;
    for (const p of b) {
      r += p[0];
      g += p[1];
      bl += p[2];
    }
    const n = b.length || 1;
    palette.push([Math.round(r / n), Math.round(g / n), Math.round(bl / n)]);
  }

  // 5-bit channel lookup table for 32x32x32 entries
  const lut = new Uint8Array(32 * 32 * 32);
  for (let r5 = 0; r5 < 32; r5 += 1) {
    const r = (r5 << 3) | (r5 >> 2);
    for (let g5 = 0; g5 < 32; g5 += 1) {
      const g = (g5 << 3) | (g5 >> 2);
      for (let b5 = 0; b5 < 32; b5 += 1) {
        const bl = (b5 << 3) | (b5 >> 2);
        let minD = 1e9;
        let minK = 0;
        for (let k = 0; k < palette.length; k += 1) {
          const pal = palette[k];
          const d = (r - pal[0]) ** 2 + (g - pal[1]) ** 2 + (bl - pal[2]) ** 2;
          if (d < minD) {
            minD = d;
            minK = k;
          }
        }
        lut[(r5 << 10) | (g5 << 5) | b5] = minK;
      }
    }
  }

  const indices = new Uint8Array(totalPixels);
  for (let i = 0; i < totalPixels; i += 1) {
    const r5 = rgb[i * 3] >> 3;
    const g5 = rgb[i * 3 + 1] >> 3;
    const b5 = rgb[i * 3 + 2] >> 3;
    indices[i] = lut[(r5 << 10) | (g5 << 5) | b5];
  }

  return { palette, indices };
}

// 4. PNG encoder for 8-bit indexed palette (colorType 3)
function writeIndexedPng(w, h, palette, indices) {
  function makeChunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const chunkCrc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(chunkCrc >>> 0, 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8); // 8-bit depth
  ihdr.writeUInt8(3, 9); // ColorType 3 = indexed-color
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);

  const plte = Buffer.alloc(palette.length * 3);
  for (let i = 0; i < palette.length; i += 1) {
    plte[i * 3] = palette[i][0];
    plte[i * 3 + 1] = palette[i][1];
    plte[i * 3 + 2] = palette[i][2];
  }

  const scanlines = Buffer.alloc(h * (1 + w));
  for (let y = 0; y < h; y += 1) {
    scanlines[y * (1 + w)] = 0; // Filter 0 (None)
    indices.subarray(y * w, (y + 1) * w).forEach((idx, x) => {
      scanlines[y * (1 + w) + 1 + x] = idx;
    });
  }
  const compressed = deflateSync(scanlines, { level: 9 });

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('PLTE', plte),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

function quantizePngFile(path, maxBytes = 262144) {
  const buf = readFileSync(path);
  const rgb = decodePngRgb(buf);
  const paletteCounts = [256, 224, 192, 160, 128];
  let best = null;
  for (const nColors of paletteCounts) {
    const { palette, indices } = quantizeMedianCut(rgb, nColors);
    const quantizedBuf = writeIndexedPng(1280, 720, palette, indices);
    best = quantizedBuf;
    if (quantizedBuf.length <= maxBytes) break;
  }
  writeFileSync(path, best);
  return best.length;
}

async function capture() {
  mkdirSync(screenshotsDir, { recursive: true });

  // Delete old/starter screenshots first
  for (const f of readdirSync(screenshotsDir)) {
    if (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')) {
      unlinkSync(join(screenshotsDir, f));
      console.log(`Removed starter screenshot: ${f}`);
    }
  }

  const server = await startServer();

  console.log('Launching Playwright Chromium...');
  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  console.log(`Navigating to http://127.0.0.1:${PORT}...`);
  await page.goto(`http://127.0.0.1:${PORT}`);

  // Wait for window.__harbor to be ready
  await page.waitForFunction(() => window.__harbor && window.__harbor.ready());
  console.log('window.__harbor is ready');

  // Let initial canvas render settle
  await page.waitForTimeout(600);

  const targets = [
    {
      file: '1-cover.png',
      state: 'chase',
      time: 19 + 40 / 60,
      wanted: 3,
      holdThrottle: true,
      desc: '19:40 dusk three-star police chase: HUD, minimap with blips, mission objective, traffic and peds',
    },
    {
      file: '2-foot.png',
      state: 'foot',
      time: 8 + 10 / 60,
      wanted: 0,
      holdThrottle: false,
      desc: '08:10 morning on foot with long shadows, street clutter and a busy sidewalk',
    },
    {
      file: '3-car.png',
      state: 'car',
      time: 17 + 20 / 60,
      wanted: 0,
      holdThrottle: true,
      desc: '17:20 golden hour driving fast with traffic, skid marks and speedometer',
    },
    {
      file: '4-mission.png',
      state: 'mission',
      time: 21.0,
      wanted: 0,
      holdThrottle: false,
      desc: '21:00 night at the docks with neon bloom, waypoint and dialogue',
    },
  ];

  for (const t of targets) {
    console.log(`Setting state: ${t.state} (${t.time.toFixed(2)}h) for ${t.file}...`);
    if (t.holdThrottle) await page.keyboard.down('KeyW');
    await page.evaluate(({ state, time, wanted }) => {
      window.__harbor.state(state);
      window.__harbor.setTime(time);
      window.__harbor.setWanted(wanted);
    }, t);
    // Wait one animation frame and re-stamp clock so HUD displays the exact target time
    await page.evaluate((time) => new Promise((r) => requestAnimationFrame(() => {
      window.__harbor.setTime(time);
      requestAnimationFrame(r);
    })), t.time);

    const outPath = join(screenshotsDir, t.file);
    await page.screenshot({ path: outPath, type: 'png' });
    if (t.holdThrottle) await page.keyboard.up('KeyW');

    let size = statSync(outPath).size;
    console.log(`Raw render size: ${size} bytes (${(size / 1024).toFixed(1)} KiB)`);

    // Quantize with adaptive palette to guarantee <= 256 KiB
    size = quantizePngFile(outPath, 262144);
    console.log(`Saved ${t.file}: ${size} bytes (${(size / 1024).toFixed(1)} KiB) — ${t.desc}`);
    if (size > 262144) {
      throw new Error(`Screenshot ${t.file} exceeds 256 KiB limit: ${size} bytes`);
    }
  }

  await browser.close();
  server.close();
  console.log('All 4 screenshots captured and verified within gate limits.');
}

capture().catch((err) => {
  console.error('Capture failed:', err);
  process.exit(1);
});
