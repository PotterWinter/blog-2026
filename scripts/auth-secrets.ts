// New secrets for the admin sign-in. Run it yourself — the values print only here:
//   npm run auth-secrets
// or into a file only you can read, printing nothing but its path:
//   npm run auth-secrets -- --out ~/Desktop/blog-secrets.txt
// TOTP_SECRET goes into the authenticator app (scan the otpauth link as a QR, or type
// the key by hand) AND into Vercel; SESSION_SECRET only into Vercel. Both as Secret.
// A new TOTP_SECRET means re-adding the account in the app; a new SESSION_SECRET signs
// every device out.
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const bits = [...randomBytes(20)].map((b) => b.toString(2).padStart(8, "0")).join("");
const totp = bits.match(/.{5}/g)!.map((b) => alphabet[parseInt(b, 2)]).join("");
const session = randomBytes(32).toString("base64url");
const label = encodeURIComponent("Code by Korn:admin");
const uri = `otpauth://totp/${label}?secret=${totp}&issuer=${encodeURIComponent("Code by Korn")}&algorithm=SHA1&digits=6&period=30`;

const text = `
TOTP_SECRET=${totp}
SESSION_SECRET=${session}

Authenticator app — add account, enter key by hand:
  account: Code by Korn   key: ${totp}   (time-based, 6 digits)
or as a link (paste into a QR generator you trust, then scan):
  ${uri}

Put both into Vercel (Environments › Production, type Secret), then delete this file.
`;

const out = process.argv.indexOf("--out");
if (out > 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], text, { mode: 0o600 });
  console.log(`Written to ${process.argv[out + 1]} (only you can read it)`);
} else {
  console.log(text);
}
