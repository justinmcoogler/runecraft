// Deterministic value noise for world generation. Everything here is pure
// arithmetic on cell coordinates — no RNG state, so the same world builds
// from the same code on every boot, every platform, every test run.

/** Per-cell hash in [0,1). Stable across runs. */
export function cellHash(x: number, z: number, salt = 0): number {
  let h = (x * 374761393 + z * 668265263 + salt * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smoothly interpolated value noise in [0,1), `scale` blocks per feature. */
export function vnoise(x: number, z: number, scale: number, salt: number): number {
  const gx = x / scale;
  const gz = z / scale;
  const x0 = Math.floor(gx);
  const z0 = Math.floor(gz);
  const fx = smooth(gx - x0);
  const fz = smooth(gz - z0);
  const a = cellHash(x0, z0, salt);
  const b = cellHash(x0 + 1, z0, salt);
  const c = cellHash(x0, z0 + 1, salt);
  const d = cellHash(x0 + 1, z0 + 1, salt);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Three-octave fractal noise in [0,1). */
export function fbm(x: number, z: number, scale: number, salt: number): number {
  return (
    vnoise(x, z, scale, salt) * 0.55 +
    vnoise(x, z, scale / 2.7, salt + 101) * 0.3 +
    vnoise(x, z, scale / 7.1, salt + 202) * 0.15
  );
}

/**
 * Domain-warped sample position: biome and coast borders sampled through
 * this wobble grow fingers, bays and pockets instead of straight edges.
 */
export function warp(x: number, z: number, amount: number, salt: number): { x: number; z: number } {
  return {
    x: x + (fbm(x, z, 210, salt + 811) - 0.5) * 2 * amount,
    z: z + (fbm(x, z, 210, salt + 907) - 0.5) * 2 * amount,
  };
}

/** Distance from point to a polyline (squared-free, fine for masks). */
export function distToPolyline(x: number, z: number, pts: Array<[number, number]>): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
    const px = ax + dx * t;
    const pz = az + dz * t;
    const d = Math.hypot(x - px, z - pz);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Catmull-Rom sample through control points; returns a dense polyline with
 * roughly one vertex per `step` blocks. Rivers and roads share this so
 * nothing in the world runs mathematically straight.
 */
export function splinePath(points: Array<[number, number]>, step = 4): Array<[number, number]> {
  if (points.length < 2) return points.slice();
  const pts: Array<[number, number]> = [points[0], ...points, points[points.length - 1]];
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length - 3; i++) {
    const [p0x, p0z] = pts[i];
    const [p1x, p1z] = pts[i + 1];
    const [p2x, p2z] = pts[i + 2];
    const [p3x, p3z] = pts[i + 3];
    const seg = Math.max(2, Math.round(Math.hypot(p2x - p1x, p2z - p1z) / step));
    for (let s = 0; s < seg; s++) {
      const t = s / seg;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([
        0.5 * (2 * p1x + (-p0x + p2x) * t + (2 * p0x - 5 * p1x + 4 * p2x - p3x) * t2 + (-p0x + 3 * p1x - 3 * p2x + p3x) * t3),
        0.5 * (2 * p1z + (-p0z + p2z) * t + (2 * p0z - 5 * p1z + 4 * p2z - p3z) * t2 + (-p0z + 3 * p1z - 3 * p2z + p3z) * t3),
      ]);
    }
  }
  out.push(points[points.length - 1]);
  return out;
}
