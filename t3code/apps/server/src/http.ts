// HTTP layer: gzip + brotli compression (issue 863).

import { zlib } from "zlib";
import type { IncomingMessage, ServerResponse } from "http";

const canBrotli = typeof zlib.brotliCompress === "function";
const canGzip   = typeof zlib.gzip        === "function";

type Encoding = "gzip" | "brotli" | "identity";

function _encoding(accept: string | undefined): Encoding | null {
  if (!accept) return null;
  const encodings = accept.split(",").map(e => e.split(";")[0].trim().toLowerCase());
  if (canBrotli && encodings.includes("br"))     return "brotli";
  if (canGzip   && encodings.includes("gzip"))   return "gzip";
  return null;
}

/**
 * Compress `body` if client accepts the encoding.
 * Skips compression when content-type already encodes the payload.
 */
export function compress(
  res   : ServerResponse,
  body  : Buffer,
  accept: string | undefined,
): Buffer {
  if (body.byteLength <= 1024) return body;
  const ct = res.getHeader("Content-Type") || "";
  if (typeof ct === "string" && /^image|video|audio|application\/(zip|gzip|compressed)/i.test(ct))
    return body;
  const enc = _encoding(accept);
  if (!enc || enc === "identity") return body;
  try {
    return enc === "brotli"
      ? zlib.brotliCompressSync(body)
      : zlib.gzipSync(body);
  } catch {
    return body;
  }
}
