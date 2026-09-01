// update-order-status
// Accepts: { order_id, new_status }
//   deposit_paid -> set deposit_paid + generate invoice
//   completed    -> stamp completed_at, set customer's first_order_completed_at
//                   (if first), generate memory card. The +2 day post_celebration
//                   and +30 day circle_followup are fired by the daily checker.
//   overdue guard -> red notification if occasion date passed while baking/ready
import { adminClient, corsHeaders, json, notify, requireServiceRole } from "../_shared/client.ts";
import { generateMemoryCard } from "../_shared/memory-card.ts";
import { generateInvoice } from "../_shared/invoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authError = requireServiceRole(req);
  if (authError) return authError;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  let b: {
    order_id?: string;
    new_status?: string;
    payment_status?: string;
    total_amount_zar?: number;
    amount_paid_zar?: number;
  };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { order_id, new_status } = b;
  if (!order_id || !new_status) return json({ error: "order_id and new_status are required" }, 400);
  const statuses = new Set(["enquiry", "quoted", "deposit_paid", "baking", "ready", "completed", "cancelled"]);
  const paymentStatuses = new Set(["unpaid", "deposit_paid", "paid_in_full"]);
  if (!statuses.has(new_status)) return json({ error: "Invalid order status" }, 400);
  if (b.payment_status !== undefined && !paymentStatuses.has(b.payment_status)) {
    return json({ error: "Invalid payment status" }, 400);
  }
  for (const amount of [b.total_amount_zar, b.amount_paid_zar]) {
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      return json({ error: "Payment amounts must be positive numbers" }, 400);
    }
  }

  const supabase = adminClient();
  const { data: before } = await supabase
    .from("orders")
    .select(`status, payment_status, occasion_date, customer_id, customer:customers ( full_name, first_order_completed_at )`)
    .eq("id", order_id).single();
  if (!before) return json({ error: "Order not found" }, 404);
  const customer = before.customer as { full_name: string; first_order_completed_at: string | null } | null;
  const name = customer?.full_name ?? "a customer";

  const update: Record<string, unknown> = { status: new_status };
  if (b.payment_status !== undefined) update.payment_status = b.payment_status;
  if (b.total_amount_zar !== undefined) update.total_amount_zar = b.total_amount_zar;
  if (b.amount_paid_zar !== undefined) update.amount_paid_zar = b.amount_paid_zar;
  if (new_status === "deposit_paid") {
    update.deposit_paid = true;
    // Dragging a card to Confirmed means Hazel has received a deposit. Keep the
    // customer-facing payment record truthful even when no separate payment
    // action was used first.
    if (b.payment_status === undefined && before.payment_status === "unpaid") {
      update.payment_status = "deposit_paid";
    }
  }
  const { error: updateError } = await supabase.from("orders").update(update).eq("id", order_id);
  if (updateError) return json({ error: updateError.message }, 500);
  await notify(supabase, "order_status_changed", `Order for ${name} moved to '${new_status}'.`, "standard", "/orders");

  const actions: Record<string, unknown> = {};

  if (new_status === "deposit_paid") {
    await supabase.from("orders").update({ deposit_paid: true }).eq("id", order_id);
    actions.invoice = await generateInvoice(supabase, order_id);
  }

  if (new_status === "completed") {
    await supabase.from("orders").update({ completed_at: new Date().toISOString() }).eq("id", order_id);
    if (before.customer_id && customer && !customer.first_order_completed_at) {
      await supabase.from("customers")
        .update({ first_order_completed_at: new Date().toISOString() })
        .eq("id", before.customer_id);
    }
    actions.memory_card = await generateMemoryCard(supabase, order_id);
  }

  if ((new_status === "baking" || new_status === "ready") && before.occasion_date) {
    const todaySast = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
    if (before.occasion_date < todaySast) {
      await notify(supabase, "order_overdue",
        `Overdue: ${name}'s order for ${before.occasion_date} has not been marked complete.`, "high");
      actions.overdue = true;
    }
  }

  return json({ status: "updated", from: before.status, to: new_status, actions });
});
