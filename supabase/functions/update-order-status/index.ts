// update-order-status
// Accepts: { order_id, new_status }
// Updates status, creates a notification, and (if completed) generates the
// memory card.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";
import { generateMemoryCard } from "../_shared/memory-card.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: { order_id?: string; new_status?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { order_id, new_status } = body;
  if (!order_id || !new_status) {
    return json({ error: "order_id and new_status are required" }, 400);
  }

  const supabase = adminClient();
  const { data: order, error } = await supabase
    .from("orders")
    .update({ status: new_status })
    .eq("id", order_id)
    .select("id, customer:customers ( full_name )")
    .single();
  if (error || !order) return json({ error: "Order not found or update failed" }, 404);

  const name = (order.customer as { full_name?: string } | null)?.full_name ?? "a customer";
  await notify(supabase, "order_status_changed",
    `Order for ${name} moved to '${new_status}'`);

  let memoryCard = null;
  if (new_status === "completed") {
    memoryCard = await generateMemoryCard(supabase, order_id);
  }

  return json({ status: "updated", new_status, memory_card: memoryCard });
});
