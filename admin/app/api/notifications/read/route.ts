import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "@/lib/auth";

export async function POST() {
  if (!(await verifySession(cookies().get(COOKIE)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  await sb.from("notifications").update({ read: true }).eq("read", false);
  return NextResponse.json({ ok: true });
}
