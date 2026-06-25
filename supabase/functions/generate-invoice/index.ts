// generate-invoice
// Accepts: { order_id }   Triggered when deposit_paid is set true.
import { adminClient, corsHeaders, json } from "../_shared/client.ts";
import { generateInvoice } from "../_shared/invoice.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let b: { order_id?: string };
  try { b = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!b.order_id) return json({ error: "order_id is required" }, 400);
  const result = await generateInvoice(adminClient(), b.order_id);
  return json(result, result.status === "failed" ? 502 : 200);
});
