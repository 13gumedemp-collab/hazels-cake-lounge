import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseAdmin();
  const { data } = await sb
    .from("notifications")
    .select("id, type, message, priority, read, created_at")
    .order("created_at", { ascending: false })
    .limit(20);
  return NextResponse.json({ notifications: data ?? [] });
}
