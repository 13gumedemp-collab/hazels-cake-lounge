import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, COOKIE, MAX_AGE } from "@/lib/auth";
import { verifyAdminPassword } from "@/lib/adminPassword";
import { consumeAdminLoginLimit } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  const limit = await consumeAdminLoginLimit(req);
  if (!limit.available) return NextResponse.json({ error: "Login is temporarily unavailable. Please try again." }, { status: 503 });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds || 900) } },
    );
  }
  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" && body.password.length <= 1024 ? body.password : "";
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  const token = await createSession();
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: MAX_AGE,
    priority: "high",
  });
  return NextResponse.json({ ok: true });
}
