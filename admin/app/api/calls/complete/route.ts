import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, COOKIE } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";
export async function POST(req: NextRequest) {
  if (!(await verifySession(cookies().get(COOKIE)?.value))) return NextResponse.json({error:"Unauthorized"},{status:401});
  const { id } = await req.json().catch(() => ({}));
  const { error } = await supabaseAdmin().from("phone_call_reminders_due").update({status:"completed",completed_at:new Date().toISOString()}).eq("id",id);
  return error ? NextResponse.json({error:error.message},{status:500}) : NextResponse.json({status:"ok"});
}
