import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST() {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin().functions.invoke("daily-occasion-checker", { body: { source: "admin" } });
  if (error) return NextResponse.json({ error: error.message }, { status: 502 });
  return NextResponse.json(data || { status: "ok" });
}
