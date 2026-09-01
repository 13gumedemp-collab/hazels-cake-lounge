import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const threadId = String(body.thread_id || "");
  const action = String(body.action || "");
  if (!threadId || !["read", "open", "close"].includes(action)) {
    return NextResponse.json({ error: "Valid thread and action are required" }, { status: 400 });
  }

  const changes: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (action === "read") changes.unread_count = 0;
  if (action === "open") changes.status = "open";
  if (action === "close") changes.status = "closed";
  const { error } = await supabaseAdmin().from("email_threads").update(changes).eq("id", threadId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
