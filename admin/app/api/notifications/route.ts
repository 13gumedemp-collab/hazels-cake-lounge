import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "@/lib/auth";
import { isMeaningfulActivity } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await verifySession(cookies().get(COOKIE)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("notifications")
    .select("id, type, message, priority, read, created_at, action_url")
    .order("created_at", { ascending: false })
    .limit(100);
  const notifications = (data ?? []).filter(isMeaningfulActivity).slice(0, 20);
  return NextResponse.json({ notifications });
}
