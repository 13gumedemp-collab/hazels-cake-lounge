// update-order-status
// Accepts: { order_id, new_status }
//   deposit_paid -> set deposit_paid + generate invoice
//   completed    -> stamp completed_at, set customer's first_order_completed_at
//                   (if first), generate memory card. The +2 day post_celebration
//                   and +30 day circle_followup are fired by the daily checker.
//   overdue guard -> red notification if occasion date passed while baking/ready
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";
import { generateMemoryCard } from "../_shared/memory-card.ts";
import { generateInvoice } from "../_shared/invoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: { order_id?: string; new_status?: string };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { order_id, new_status } = b;
  if (!order_id || !new_status) return json({ error: "order_id and new_status are required" }, 400);

  const supabase = adminClient();
  const { data: before } = await supabase
    .from("orders")
    .select(`status, occasion_date, customer_id, customer:customers ( full_name, first_order_completed_at )`)
    .eq("id", order_id).single();
  if (!before) return json({ error: "Order not found" }, 404);
  const customer = before.customer as { full_name: string; first_order_completed_at: string | null } | null;
  const name = customer?.full_name ?? "a customer";

  await supabase.from("orders").update({ status: new_status }).eq("id", order_id);
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
    await notify(supabase, "memory_card_sent", `Memory Card sent to ${name}.`);
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
