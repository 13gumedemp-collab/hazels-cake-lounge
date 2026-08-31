import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { supabaseAdmin } from "./supabaseServer";

function same(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyHash(candidate: string, stored: string) {
  const [scheme, salt, expected] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expected) return false;
  const actual = scryptSync(candidate, salt, 64).toString("hex");
  return same(actual, expected);
}

export function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString("hex")}`;
}

export async function verifyAdminPassword(candidate: string) {
  if (!candidate) return false;
  const { data } = await supabaseAdmin().from("app_settings").select("value").eq("key", "admin_auth").maybeSingle();
  const stored = data?.value && typeof data.value === "object" && "password_hash" in data.value
    ? String(data.value.password_hash || "")
    : "";
  if (stored) return verifyHash(candidate, stored);
  return same(candidate, process.env.ADMIN_PASSWORD || "");
}
