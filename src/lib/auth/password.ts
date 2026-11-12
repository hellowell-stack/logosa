import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt from Node's standard library — no native
 * module to compile, nothing to install, and it runs on every host Next does.
 *
 * Stored as `scrypt$N$r$p$salt$hash`, so the cost can be raised later without
 * invalidating existing passwords: verification reads the parameters back out
 * of the stored string.
 *
 * N = 2^15 uses 32 MB per hash. OWASP's figure is 2^17, which at 128 MB is
 * more than a small serverless function should spend on one login.
 */

const N = 32768;
const R = 8;
const P = 1;
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export const PASSWORD_MIN = 10;

function derive(password: string, salt: Buffer, n: number, r: number, p: number, len: number) {
  return new Promise<Buffer>((resolve, reject) => {
    const opts: ScryptOptions = { N: n, r, p, maxmem: MAXMEM };
    scrypt(password.normalize("NFKC"), salt, len, opts, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), +n, +r, +p, expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/**
 * Checked against when the email matches no account, so a login attempt takes
 * as long for a nonexistent address as for a real one and the timing does not
 * reveal which staff emails exist.
 */
let dummy: Promise<string> | undefined;
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString("hex")));

/** Why a new password is unacceptable, or undefined. Length is the rule that matters. */
export function passwordProblem(password: string): string | undefined {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > 200) return "That is longer than it needs to be — 200 characters at most.";
  return undefined;
}
