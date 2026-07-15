// Synchronous browser-side PNG decoder for baked default textures: the
// bundle ships original PNG bytes (small) instead of raw RGBA (huge), and
// boot decodes them without async Image plumbing. Inflate comes from
// fflate, which the pack importer already bundles.
//
// This is a TypeScript port of decodePng in game/scripts/png-color.mjs —
// keep the two in sync. Supports bit depth 8 for gray/RGB/RGBA/gray+alpha
// (plus Adam7 interlace) and palette at depths 1/2/4/8.

import { unzlibSync } from "fflate";

export interface DecodedPng {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
}

export function decodePngBytes(b: Uint8Array): DecodedPng | null {
  try {
    const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (sig.some((v, i) => b[i] !== v)) return null;
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);

    let width = 0, height = 0, bitDepth = 0, colorType = 0, interlace = 0;
    let palette: Uint8Array | null = null;
    let trns: Uint8Array | null = null;
    const idat: Uint8Array[] = [];
    for (let pos = 8; pos + 8 <= b.length;) {
      const len = view.getUint32(pos);
      const type = String.fromCharCode(b[pos + 4], b[pos + 5], b[pos + 6], b[pos + 7]);
      const data = b.subarray(pos + 8, pos + 8 + len);
      if (type === "IHDR") {
        width = view.getUint32(pos + 8);
        height = view.getUint32(pos + 12);
        bitDepth = b[pos + 16];
        colorType = b[pos + 17];
        interlace = b[pos + 20];
      } else if (type === "PLTE") palette = data;
      else if (type === "tRNS") trns = data;
      else if (type === "IDAT") idat.push(data);
      else if (type === "IEND") break;
      pos += 12 + len;
    }
    if (!width || !height) return null;
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
    if (!channels) return null;
    if (colorType === 3 ? ![1, 2, 4, 8].includes(bitDepth) : bitDepth !== 8) return null;
    if (interlace !== 0 && (interlace !== 1 || bitDepth !== 8)) return null;

    const total = idat.reduce((n, d) => n + d.length, 0);
    const joined = new Uint8Array(total);
    let at = 0;
    for (const d of idat) {
      joined.set(d, at);
      at += d.length;
    }
    const raw = unzlibSync(joined);
    const bpp = Math.max(1, Math.ceil((channels * bitDepth) / 8));
    const stride = Math.ceil((width * channels * bitDepth) / 8);

    // Un-filter a run of scanlines (one filter byte + rowBytes each).
    const unfilter = (offset: number, rows: number, rowBytes: number): Uint8Array | null => {
      const out = new Uint8Array(rows * rowBytes);
      for (let y = 0; y < rows; y++) {
        const filter = raw[offset + y * (rowBytes + 1)];
        const line = raw.subarray(offset + y * (rowBytes + 1) + 1, offset + (y + 1) * (rowBytes + 1));
        const row = out.subarray(y * rowBytes, (y + 1) * rowBytes);
        const prev = y > 0 ? out.subarray((y - 1) * rowBytes, y * rowBytes) : null;
        for (let i = 0; i < rowBytes; i++) {
          const a = i >= bpp ? row[i - bpp] : 0;
          const up = prev ? prev[i] : 0;
          const c = prev && i >= bpp ? prev[i - bpp] : 0;
          let v = line[i];
          if (filter === 1) v += a;
          else if (filter === 2) v += up;
          else if (filter === 3) v += (a + up) >> 1;
          else if (filter === 4) {
            const p = a + up - c;
            const pa = Math.abs(p - a), pb = Math.abs(p - up), pc = Math.abs(p - c);
            v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
          } else if (filter !== 0) return null;
          row[i] = v & 0xff;
        }
      }
      return out;
    };

    let img: Uint8Array;
    if (interlace === 0) {
      if (raw.length < height * (stride + 1)) return null;
      const flat = unfilter(0, height, stride);
      if (!flat) return null;
      img = flat;
    } else {
      // Adam7: seven sub-images, each filtered independently, scattered
      // back onto the full-size canvas at their pass offsets.
      img = new Uint8Array(height * stride);
      const passes: Array<[number, number, number, number]> = [
        [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
        [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
      ];
      let offset = 0;
      for (const [xs, ys, xStep, yStep] of passes) {
        const pw = Math.ceil(Math.max(0, width - xs) / xStep);
        const ph = Math.ceil(Math.max(0, height - ys) / yStep);
        if (pw === 0 || ph === 0) continue;
        const rowBytes = pw * channels;
        if (raw.length < offset + ph * (rowBytes + 1)) return null;
        const pass = unfilter(offset, ph, rowBytes);
        if (!pass) return null;
        for (let py = 0; py < ph; py++) {
          for (let px = 0; px < pw; px++) {
            const src = py * rowBytes + px * channels;
            const dst = (ys + py * yStep) * stride + (xs + px * xStep) * channels;
            for (let ch = 0; ch < channels; ch++) img[dst + ch] = pass[src + ch];
          }
        }
        offset += ph * (rowBytes + 1);
      }
    }

    // Expand to straight RGBA.
    const bitAt = (row: number, index: number): number => {
      const bitPos = index * bitDepth;
      const byte = img[row * stride + (bitPos >> 3)];
      return (byte >> (8 - bitDepth - (bitPos & 7))) & ((1 << bitDepth) - 1);
    };
    const rgba = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let pr: number, pg: number, pb: number, pa = 255;
        if (colorType === 3) {
          const idx = bitAt(y, x);
          if (!palette || idx * 3 + 2 >= palette.length) return null;
          pr = palette[idx * 3]; pg = palette[idx * 3 + 1]; pb = palette[idx * 3 + 2];
          if (trns && idx < trns.length) pa = trns[idx];
        } else {
          const o = y * stride + x * channels;
          if (colorType === 0) { pr = pg = pb = img[o]; }
          else if (colorType === 4) { pr = pg = pb = img[o]; pa = img[o + 1]; }
          else { pr = img[o]; pg = img[o + 1]; pb = img[o + 2]; if (colorType === 6) pa = img[o + 3]; }
        }
        const o4 = (y * width + x) * 4;
        rgba[o4] = pr; rgba[o4 + 1] = pg; rgba[o4 + 2] = pb; rgba[o4 + 3] = pa;
      }
    }
    return { width, height, rgba };
  } catch {
    return null;
  }
}

/** Base64 (as emitted by the bake script) -> decoded PNG, or null. */
export function decodePngBase64(b64: string): DecodedPng | null {
  try {
    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return decodePngBytes(bytes);
  } catch {
    return null;
  }
}
