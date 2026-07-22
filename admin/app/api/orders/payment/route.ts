import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, COOKIE } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  const token = cookies().get(COOKIE)?.value;
  if (!(await verifySession(token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  if (!body.order_id || !["unpaid", "deposit_paid", "paid_in_full"].includes(body.payment_status)) {
    return NextResponse.json({ error: "Invalid payment update" }, { status: 400 });
  }
  const update: Record<string, unknown> = {
    payment_status: body.payment_status,
    deposit_paid: body.payment_status !== "unpaid",
  };
  if (body.total_amount_zar !== null) update.total_amount_zar = Number(body.total_amount_zar);
  if (body.amount_paid_zar !== null) update.amount_paid_zar = Number(body.amount_paid_zar);
  const { error } = await supabaseAdmin().from("orders").update(update).eq("id", body.order_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
