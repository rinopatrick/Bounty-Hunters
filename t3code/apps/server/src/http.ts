// Response compression: gzip + brotli for T3 Code server.

import { zlib } from "zlib";
import type { IncomingMessage, ServerResponse } from "http";

const brotliEnabled = typeof zlib.brotliCompress === "function";
const gzipEnabled   = typeof zlib.gzip === "function";

type Encoding = "gzip" | "brotli" | "identity";

function detectEncoding(header: string | undefined, threshold: number): Encoding | null {
  if (!header) return null;
  const list = header.split(",").map(s => s.split(";")[0].trim());
  if (brotliEnabled && list.includes("br")) return "brotli";
  if (gzipEnabled   && list.includes("gzip")) return "gzip";
  return null;
}

export function compressResponse(
  res   : ServerResponse,
  body  : Buffer,
  accept: string | undefined,
): Buffer {
  const enc = detectEncoding(accept, body.byteLength > 1024);
  if (!enc || enc === "identity") return body;
  try {
    return enc === "brotli"
      ? zlib.brotliCompressSync(body)
      : zlib.gzipSync(body);
  } catch {
    return body;
  }
}
