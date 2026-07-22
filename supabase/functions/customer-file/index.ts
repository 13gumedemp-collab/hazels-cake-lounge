import { adminClient, corsHeaders, json } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const supabase = adminClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (!body.order_id || !["invoice", "receipt"].includes(body.kind)) return json({ error: "Invalid request" }, 400);
  const { data: customer } = await supabase.from("customers").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!customer) return json({ error: "Customer not found" }, 404);
  const column = body.kind === "invoice" ? "invoice_path" : "receipt_path";
  const { data: order } = await supabase.from("orders").select(`id,${column}`).eq("id", body.order_id).eq("customer_id", customer.id).maybeSingle();
  const path = order?.[column];
  if (!path) return json({ error: "File not available" }, 404);
  const bucket = body.kind === "invoice" ? "invoices" : "receipts";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return json({ error: "Could not open file" }, 500);
  return json({ url: data.signedUrl });
});
