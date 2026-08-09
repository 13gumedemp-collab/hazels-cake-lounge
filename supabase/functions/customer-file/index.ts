import { adminClient, corsHeaders, json } from "../_shared/client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);
  const supabase = adminClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const { data: customer } = await supabase.from("customers").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  if (!customer) return json({ error: "Customer not found" }, 404);

  // Inspiration pictures live in a private bucket, so the account page needs a
  // short-lived signed URL to show a thumbnail. The path is never trusted from
  // the request: it has to already be listed on one of this customer's own
  // saved dates, otherwise anyone could sign anyone else's picture.
  if (body.kind === "inspiration") {
    const path = String(body.path || "");
    if (!path) return json({ error: "Invalid request" }, 400);

    // Two ways a path can belong to this customer, and both are needed.
    //
    // 1. It is already listed on one of their saved dates.
    // 2. It sits in their own folder. Uploads are written to `<customer id>/…`,
    //    and a picture added while the edit form is open has not been saved to
    //    photo_paths yet. Without this the thumbnail of a just-uploaded picture
    //    could never load, which is exactly what happened.
    //
    // The customer id is taken from their JWT, never from the request, so this
    // cannot be used to reach into anyone else's folder.
    const ownFolder = path.startsWith(`${customer.id}/`);
    let owns = ownFolder;
    if (!owns) {
      const { data: row } = await supabase
        .from("circle_members").select("id")
        .eq("customer_id", customer.id).contains("photo_paths", [path]).maybeSingle();
      owns = !!row;
    }
    if (!owns) return json({ error: "Not found" }, 404);
    const { data, error } = await supabase.storage.from("inspiration-photos").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return json({ error: "Could not open file" }, 500);
    return json({ url: data.signedUrl });
  }

  if (!body.order_id || !["invoice", "receipt"].includes(body.kind)) return json({ error: "Invalid request" }, 400);
  const column = body.kind === "invoice" ? "invoice_path" : "receipt_path";
  const { data: order } = await supabase.from("orders").select(`id,${column}`).eq("id", body.order_id).eq("customer_id", customer.id).maybeSingle();
  const path = order?.[column];
  if (!path) return json({ error: "File not available" }, 404);
  const bucket = body.kind === "invoice" ? "invoices" : "receipts";
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) return json({ error: "Could not open file" }, 500);
  return json({ url: data.signedUrl });
});
