// update-order-status
// Accepts: { order_id, new_status }
// Drives the order pipeline automation based on the status transition:
//   confirmed -> deposit_paid : generate + email PDF invoice
//   baking    -> ready        : notify + email collection/delivery notice
//   ready     -> completed    : generate-memory-card (post_celebration follows
//                               automatically via the daily checker, +2 days)
//   any change where occasion_date has passed and status is baking/ready:
//                               raise a high-priority (red) overdue notification
import { adminClient, businessVars, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { generateMemoryCard } from "../_shared/memory-card.ts";
import { generateInvoice } from "../_shared/invoice.ts";
import { sendEmail } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: { order_id?: string; new_status?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { order_id, new_status } = body;
  if (!order_id || !new_status) return json({ error: "order_id and new_status are required" }, 400);

  const supabase = adminClient();

  // Read current state first so we know the transition.
  const { data: before } = await supabase
    .from("orders")
    .select(`status, occasion_date, delivery_or_collection,
             customer:customers ( id, full_name ),
             occasion:occasions ( person_name, occasion_type )`)
    .eq("id", order_id)
    .single();
  if (!before) return json({ error: "Order not found" }, 404);
  const oldStatus = before.status;
  const customer = before.customer as { id: string; full_name: string } | null;
  const occasion = before.occasion as { person_name: string; occasion_type: string } | null;
  const name = customer?.full_name ?? "a customer";

  const { error: updErr } = await supabase.from("orders").update({ status: new_status }).eq("id", order_id);
  if (updErr) return json({ error: "Update failed" }, 500);
  await notify(supabase, "order_status_changed", `Order for ${name} moved to '${new_status}'.`);

  const actions: Record<string, unknown> = {};

  // confirmed -> deposit_paid : invoice
  if (oldStatus === "confirmed" && new_status === "deposit_paid") {
    await supabase.from("orders").update({ deposit_paid: true }).eq("id", order_id);
    actions.invoice = await generateInvoice(supabase, order_id);
  }

  // baking -> ready : ready notice
  if (oldStatus === "baking" && new_status === "ready") {
    await notify(supabase, "order_ready",
      `${name}'s order is marked ready. Notify them for collection or delivery.`);
    if (customer) {
      actions.ready_email = await sendEmail(supabase, {
        customer_id: customer.id, template_name: "order_ready", reminder_type: "order_ready",
        dynamic_variables: {
          ...businessVars(), first_name: firstName(name),
          person_name: occasion?.person_name ?? "", occasion_type: occasion?.occasion_type ?? "",
          fulfilment: before.delivery_or_collection ?? "collection",
        },
      });
    }
  }

  // ready -> completed : memory card
  if (new_status === "completed") {
    actions.memory_card = await generateMemoryCard(supabase, order_id);
    await notify(supabase, "memory_card_sent", `Memory Card sent to ${name}.`);
  }

  // Overdue guard
  if ((new_status === "baking" || new_status === "ready") && before.occasion_date) {
    const todaySast = new Date(Date.now() + 2 * 3600 * 1000).toISOString().slice(0, 10);
    if (before.occasion_date < todaySast) {
      await notify(supabase, "order_overdue",
        `RED: Overdue. ${name}'s order for ${before.occasion_date} has not been marked complete.`);
      actions.overdue = true;
    }
  }

  return json({ status: "updated", from: oldStatus, to: new_status, actions });
});
