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
  const toAmount = (value: unknown) => {
    if (value === null || value === undefined || value === "") return null;
    const amount = Number(value);
    return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
  };
  const total = toAmount(body.total_amount_zar);
  const paid = toAmount(body.amount_paid_zar);
  if (total === undefined || paid === undefined) {
    return NextResponse.json({ error: "Payment amounts must be positive numbers" }, { status: 400 });
  }
  if (total !== null && paid !== null && paid > total) {
    return NextResponse.json({ error: "Amount paid cannot be more than the order total" }, { status: 400 });
  }
  const sb = supabaseAdmin();
  const { data: order, error: lookupError } = await sb.from("orders")
    .select("status").eq("id", body.order_id).single();
  if (lookupError || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // A recorded payment is the point at which a quote becomes a committed cake.
  // Route that first confirmation through the shared order-status function so
  // the stage rail, invoice and admin activity agree with the payment record.
  const needsConfirmation = body.payment_status !== "unpaid" && ["enquiry", "quoted"].includes(order.status);
  if (needsConfirmation) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    const response = await fetch(`${url}/functions/v1/update-order-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        order_id: body.order_id,
        new_status: "deposit_paid",
        payment_status: body.payment_status,
        ...(total !== null ? { total_amount_zar: total } : {}),
        ...(paid !== null ? { amount_paid_zar: paid } : {}),
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json(result, { status: response.status });
    return NextResponse.json({ status: "ok", confirmation: true, actions: result.actions ?? {} });
  }

  const update: Record<string, unknown> = {
    payment_status: body.payment_status,
    deposit_paid: body.payment_status !== "unpaid",
  };
  if (total !== null) update.total_amount_zar = total;
  if (paid !== null) update.amount_paid_zar = paid;
  const { error } = await sb.from("orders").update(update).eq("id", body.order_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
