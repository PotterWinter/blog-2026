import { createHmac, timingSafeEqual } from "node:crypto";

// TOTP (RFC 6238), the 6-digit code an authenticator app shows: an HMAC-SHA1 of the
// number of 30-second steps since 1970, keyed with a shared secret, cut down to 6
// digits (RFC 4226 "dynamic truncation"). Written out here rather than pulled from a
// library, so every layer of the login is readable.

const STEP = 30;
const DIGITS = 6;
// Accept the code from one step either side, for a phone clock a little off
const DRIFT = 1;

// Secrets travel as base32 (A–Z, 2–7), the form authenticator apps take
function base32(text: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of text.toUpperCase().replace(/[\s=]/g, "")) {
    const v = alphabet.indexOf(ch);
    if (v < 0) throw new Error("TOTP secret isn't base32");
    bits += v.toString(2).padStart(5, "0");
  }
  const bytes = bits.match(/.{8}/g) ?? [];
  return Buffer.from(bytes.map((b) => parseInt(b, 2)));
}

function codeAt(key: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac("sha1", key).update(msg).digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const n = (hash.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return String(n).padStart(DIGITS, "0");
}

// The step the code matched (so a used code can be refused), or null
export function verifyTotp(secret: string, code: string, now = Date.now()): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const key = base32(secret);
  const counter = Math.floor(now / 1000 / STEP);
  for (let d = -DRIFT; d <= DRIFT; d++) {
    const expected = Buffer.from(codeAt(key, counter + d));
    if (timingSafeEqual(expected, Buffer.from(code))) return counter + d;
  }
  return null;
}

// For tests and the setup script
export function totpNow(secret: string, now = Date.now()): string {
  return codeAt(base32(secret), Math.floor(now / 1000 / STEP));
}
