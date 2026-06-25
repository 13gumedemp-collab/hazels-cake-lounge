import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST() {
  const sb = supabaseAdmin();
  await sb.from("notifications").update({ read: true }).eq("read", false);
  return NextResponse.json({ ok: true });
}
