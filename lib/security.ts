import { createHash, createHmac, randomUUID, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type Session = { sub: string; role: "admin" | "person"; exp: number };

const ADMIN_COOKIE = "heliq_admin";
const PERSON_COOKIE = "heliq_person";

function secret() {
  return process.env.HELIQ_SESSION_SECRET || "dev-heliq-session-secret-change-me";
}

export function hashPin(pin: string) {
  const pepper = process.env.HELIQ_PIN_PEPPER || "dev-heliq-pin-pepper-change-me";
  return createHash("sha256").update(`${pepper}:${pin}`).digest("hex");
}

export function verifyAdminPassword(password: string) {
  const expected = process.env.HELIQ_ADMIN_PASSWORD || "heliq-admin";
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function signSession(payload: Omit<Session, "exp">, hours = 12) {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + hours * 3600_000 })).toString("base64url");
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readToken(token?: string): Session | null {
  if (!token?.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  if (sig !== expected) return null;
  const parsed = JSON.parse(Buffer.from(body, "base64url").toString()) as Session;
  return parsed.exp > Date.now() ? parsed : null;
}

export async function getAdminSession() {
  return readToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export async function getPersonSession() {
  return readToken((await cookies()).get(PERSON_COOKIE)?.value);
}

export function sessionCookieName(role: "admin" | "person") {
  return role === "admin" ? ADMIN_COOKIE : PERSON_COOKIE;
}

export function newId(prefix: string) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}
