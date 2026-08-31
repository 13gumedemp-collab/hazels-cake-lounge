import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await req.json().catch(() => ({ id: "" }));
  if (!id) return NextResponse.json({ error: "Task id required" }, { status: 400 });
  const { error } = await supabaseAdmin()
    .from("whatsapp_reminders_due")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 500 })
    : NextResponse.json({ ok: true });
}
