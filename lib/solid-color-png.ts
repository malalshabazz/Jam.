import * as FileSystem from "expo-file-system/legacy";

export type RgbaColor = { r: number; g: number; b: number; a: number };

/** Parse `#rgb` / `#rrggbb` / `rgb()` / `rgba()` into 0–255 channels. */
export function parseCssColor(value: unknown): RgbaColor | null {
  if (typeof value !== "string") return null;
  const input = value.trim().toLowerCase();
  if (!input) return null;

  const hex = input.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const raw = hex[1]!;
    if (raw.length === 3) {
      return {
        r: parseInt(raw[0]! + raw[0]!, 16),
        g: parseInt(raw[1]! + raw[1]!, 16),
        b: parseInt(raw[2]! + raw[2]!, 16),
        a: 1,
      };
    }
    return {
      r: parseInt(raw.slice(0, 2), 16),
      g: parseInt(raw.slice(2, 4), 16),
      b: parseInt(raw.slice(4, 6), 16),
      a: 1,
    };
  }

  const rgba = input.match(
    /^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/,
  );
  if (!rgba) return null;
  return {
    r: clampByte(Number(rgba[1])),
    g: clampByte(Number(rgba[2])),
    b: clampByte(Number(rgba[3])),
    a: rgba[4] == null ? 1 : clampUnit(Number(rgba[4])),
  };
}

function clampByte(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(255, Math.round(value)));
}

function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(1, value));
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    crc ^= bytes[i]!;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array) {
  let a = 1;
  let b = 0;
  for (let i = 0; i < bytes.length; i += 1) {
    a = (a + bytes[i]!) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(value: number) {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function pngChunk(type: string, data: Uint8Array) {
  const typeBytes = Uint8Array.from(type.split("").map((char) => char.charCodeAt(0)));
  const length = u32be(data.length);
  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  const crc = u32be(crc32(crcInput));
  const out = new Uint8Array(4 + typeBytes.length + data.length + 4);
  out.set(length, 0);
  out.set(typeBytes, 4);
  out.set(data, 8);
  out.set(crc, 8 + data.length);
  return out;
}

/** Zlib-wrapped DEFLATE stored blocks (no compression) for small RGB bitmaps. */
function zlibStore(raw: Uint8Array) {
  const chunks: number[] = [0x78, 0x01];
  let offset = 0;
  while (offset < raw.length) {
    const size = Math.min(65535, raw.length - offset);
    const isFinal = offset + size >= raw.length ? 1 : 0;
    chunks.push(isFinal);
    chunks.push(size & 0xff, (size >> 8) & 0xff);
    chunks.push(~size & 0xff, (~size >> 8) & 0xff);
    for (let i = 0; i < size; i += 1) chunks.push(raw[offset + i]!);
    offset += size;
  }
  const checksum = u32be(adler32(raw));
  chunks.push(...checksum);
  return Uint8Array.from(chunks);
}

function bytesToBase64(bytes: Uint8Array) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = i + 1 < bytes.length ? bytes[i + 1]! : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2]! : 0;
    const triplet = (a << 16) | (b << 8) | c;
    out += chars[(triplet >> 18) & 63];
    out += chars[(triplet >> 12) & 63];
    out += i + 1 < bytes.length ? chars[(triplet >> 6) & 63] : "=";
    out += i + 2 < bytes.length ? chars[triplet & 63] : "=";
  }
  return out;
}

/**
 * Write a solid RGB PNG. Use clip opacity separately for translucent washes.
 */
export async function writeSolidRgbPngFile(
  fileUri: string,
  width: number,
  height: number,
  color: RgbaColor,
  options?: { maxEdge?: number },
) {
  const maxEdge = options?.maxEdge ?? 1920;
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  // Keep even dimensions for video pipelines.
  const evenW = w % 2 === 0 ? w : w + 1;
  const evenH = h % 2 === 0 ? h : h + 1;
  const rowSize = 1 + evenW * 3;
  const raw = new Uint8Array(rowSize * evenH);
  for (let y = 0; y < evenH; y += 1) {
    const rowStart = y * rowSize;
    raw[rowStart] = 0;
    for (let x = 0; x < evenW; x += 1) {
      const px = rowStart + 1 + x * 3;
      raw[px] = color.r;
      raw[px + 1] = color.g;
      raw[px + 2] = color.b;
    }
  }

  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk(
    "IHDR",
    Uint8Array.from([...u32be(evenW), ...u32be(evenH), 8, 2, 0, 0, 0]),
  );
  const idat = pngChunk("IDAT", zlibStore(raw));
  const iend = pngChunk("IEND", new Uint8Array());
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  png.set(signature, 0);
  png.set(ihdr, signature.length);
  png.set(idat, signature.length + ihdr.length);
  png.set(iend, signature.length + ihdr.length + idat.length);

  await FileSystem.writeAsStringAsync(fileUri, bytesToBase64(png), {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { width: evenW, height: evenH, uri: fileUri };
}
