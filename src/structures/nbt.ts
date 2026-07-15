// Minimal NBT reader for structure imports: gzipped or raw, big-endian,
// full tag set. Returns plain JS values; scalar longs come back as numbers
// (all fields we consume fit comfortably) but long ARRAYS stay bigints —
// litematic block states are bit-packed and need every bit intact.
// No engine imports — testable headless.

import { gunzipSync } from "fflate";

export type NbtValue =
  | number
  | string
  | number[]
  | bigint[] // TAG_LONG_ARRAY only
  | NbtValue[]
  | { [key: string]: NbtValue };

export interface NbtRoot {
  name: string;
  value: { [key: string]: NbtValue };
}

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;
const TAG_LONG_ARRAY = 12;

class Reader {
  private view: DataView;
  private pos = 0;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  u8(): number { const v = this.view.getUint8(this.pos); this.pos += 1; return v; }
  i8(): number { const v = this.view.getInt8(this.pos); this.pos += 1; return v; }
  i16(): number { const v = this.view.getInt16(this.pos); this.pos += 2; return v; }
  u16(): number { const v = this.view.getUint16(this.pos); this.pos += 2; return v; }
  i32(): number { const v = this.view.getInt32(this.pos); this.pos += 4; return v; }
  i64(): number { const v = this.view.getBigInt64(this.pos); this.pos += 8; return Number(v); }
  u64(): bigint { const v = this.view.getBigUint64(this.pos); this.pos += 8; return v; }
  f32(): number { const v = this.view.getFloat32(this.pos); this.pos += 4; return v; }
  f64(): number { const v = this.view.getFloat64(this.pos); this.pos += 8; return v; }
  str(): string {
    const len = this.u16();
    const slice = this.bytes.subarray(this.pos, this.pos + len);
    this.pos += len;
    return new TextDecoder().decode(slice);
  }
}

function readPayload(r: Reader, type: number): NbtValue {
  switch (type) {
    case TAG_BYTE: return r.i8();
    case TAG_SHORT: return r.i16();
    case TAG_INT: return r.i32();
    case TAG_LONG: return r.i64();
    case TAG_FLOAT: return r.f32();
    case TAG_DOUBLE: return r.f64();
    case TAG_BYTE_ARRAY: {
      const n = r.i32();
      const out = new Array<number>(n);
      for (let i = 0; i < n; i++) out[i] = r.u8();
      return out;
    }
    case TAG_STRING: return r.str();
    case TAG_LIST: {
      const itemType = r.u8();
      const n = r.i32();
      const out = new Array<NbtValue>(n);
      for (let i = 0; i < n; i++) out[i] = readPayload(r, itemType);
      return out;
    }
    case TAG_COMPOUND: {
      const out: { [key: string]: NbtValue } = {};
      for (;;) {
        const childType = r.u8();
        if (childType === TAG_END) break;
        const name = r.str();
        out[name] = readPayload(r, childType);
      }
      return out;
    }
    case TAG_INT_ARRAY: {
      const n = r.i32();
      const out = new Array<number>(n);
      for (let i = 0; i < n; i++) out[i] = r.i32();
      return out;
    }
    case TAG_LONG_ARRAY: {
      const n = r.i32();
      const out = new Array<bigint>(n);
      for (let i = 0; i < n; i++) out[i] = r.u64();
      return out;
    }
    default:
      throw new Error(`Unknown NBT tag type ${type}`);
  }
}

/** Parse an NBT blob (gzip detected by magic bytes). */
export function parseNbt(bytes: Uint8Array): NbtRoot {
  const raw = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
  const r = new Reader(raw);
  const rootType = r.u8();
  if (rootType !== TAG_COMPOUND) throw new Error("NBT root is not a compound tag");
  const name = (r as unknown as { str(): string }).str();
  const value = readPayload(r, TAG_COMPOUND) as { [key: string]: NbtValue };
  return { name, value };
}
