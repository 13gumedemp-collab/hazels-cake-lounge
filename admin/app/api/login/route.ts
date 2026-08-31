import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSession, COOKIE, MAX_AGE } from "@/lib/auth";
import { verifyAdminPassword } from "@/lib/adminPassword";

export async function POST(req: Request) {
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (!(await verifyAdminPassword(password))) {
    return NextResponse.json({ error: "invalid" }, { status: 401 });
  }
  const token = await createSession();
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return NextResponse.json({ ok: true });
}
