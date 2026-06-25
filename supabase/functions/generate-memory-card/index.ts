// generate-memory-card
// Accepts: { order_id }
import { adminClient, corsHeaders, json } from "../_shared/client.ts";
import { generateMemoryCard } from "../_shared/memory-card.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  let body: { order_id?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  if (!body.order_id) return json({ error: "order_id is required" }, 400);

  const result = await generateMemoryCard(adminClient(), body.order_id);
  return json(result, result.status === "failed" ? 502 : 200);
});
