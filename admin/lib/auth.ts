import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "hcl_admin";
export const MAX_AGE = 8 * 60 * 60; // 8 hours

function secret() {
  return new TextEncoder().encode(
    process.env.AUTH_SECRET || process.env.ADMIN_PASSWORD || "dev-secret-change-me",
  );
}

export async function createSession(): Promise<string> {
  return await new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret());
}

export async function verifySession(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
