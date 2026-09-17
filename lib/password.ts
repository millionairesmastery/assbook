import { scrypt, timingSafeEqual } from "node:crypto";
import { HttpError, legacyPasswordHash, equal } from "./server";

const prefix = "scrypt$16384$8$5$";
// 16 MiB memory profile from OWASP's recommended scrypt configurations.
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, result) => error ? reject(error) : resolve(result));
  });
}
export function passwordInput(value: unknown, creating = false) {
  if (typeof value !== "string" || value.length > 128 || value.length < (creating ? 15 : 1))
    throw new HttpError(400, creating ? "Use a password with 15 to 128 characters." : "Enter your password.");
  if (creating && (value.trim().length < 15 || /^(.)\1+$/.test(value) ||
    /^(password|123456789|qwerty|assbook)[\d\W_]*$/i.test(value)))
    throw new HttpError(400, "Choose a less predictable password. A few unrelated words work well.");
  return value;
}
export async function passwordHash(password: string, salt: string) {
  return prefix + (await derive(password, salt)).toString("hex");
}
export async function verifyPassword(password: string, stored: string | null, salt: string | null) {
  if (stored?.startsWith(prefix) && salt) {
    const expected = Buffer.from(stored.slice(prefix.length), "hex");
    const actual = await derive(password, salt);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
  if (stored && /^[a-f0-9]{64}$/.test(stored) && salt)
    return equal(await legacyPasswordHash(password.trim(), salt), stored);
  // Missing accounts still do the expensive work before returning a generic error.
  await derive(password, "assbook-unregistered-account");
  return false;
}
export function legacyHash(stored: string) { return !stored.startsWith(prefix); }
