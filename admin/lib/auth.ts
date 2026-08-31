import { SignJWT, jwtVerify } from "jose";

export const COOKIE = "hcl_admin";
export const MAX_AGE = 8 * 60 * 60; // 8 hours

function secret(): Uint8Array {
  const configured = process.env.AUTH_SECRET;
  if (configured) return new TextEncoder().encode(configured);
  // A predictable fallback would let an attacker mint an admin cookie. Local
  // development is allowed to work without setup, but a production build must
  // never start with a derived or default signing secret.
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be configured in production.");
  }
  return new TextEncoder().encode("hcl-local-development-session-secret");
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
    const { payload } = await jwtVerify(token, secret());
    return payload.role === "admin";
  } catch {
    return false;
  }
}
