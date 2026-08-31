// Customer-initiated account deletion (POPIA right to erasure).
//
// What goes and what stays is a deliberate split:
//   * customers row      -> deleted. Name, address, phone, consents, all of it.
//   * circle_members     -> deleted with it, by ON DELETE CASCADE.
//   * orders             -> kept, customer_id set to null by ON DELETE SET NULL.
//   * reminder_log       -> kept, customer_id set to null the same way.
//   * auth user          -> deleted, so the sign in itself stops working.
//
// Orders survive on purpose. SARS requires sales records to be kept for five
// years, so they are anonymised rather than destroyed. That is the lawful
// position and the customer is told it plainly in the account page copy.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";

function storagePaths(value: unknown): string[] {
  const input = Array.isArray(value) ? value : [];
  return input.map((path) => String(path || "")).filter((path) =>
    /^(?:enq|book)-[a-z0-9]{8,}-[A-Za-z0-9._-]{1,100}$/.test(path) ||
    /^[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,140}$/.test(path)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let survey: { reason?: unknown; feedback?: unknown } = {};
  try {
    survey = await req.json();
  } catch {
    // The survey is optional, so an empty request has exactly the same effect.
  }
  const reason = typeof survey.reason === "string" ? survey.reason.trim() : "";
  const feedback = typeof survey.feedback === "string" ? survey.feedback.trim() : "";
  if (reason.length > 120 || feedback.length > 2000) {
    return json({ error: "Feedback is too long" }, 400);
  }

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const supabase = adminClient();
  // The caller proves who they are with their own JWT. Nothing in the body is
  // trusted, so there is no id to tamper with and no way to delete anyone else.
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Unauthorized" }, 401);

  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, email, profile_image_path")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();

  if (customer) {
    // Gather every customer-owned upload before the cascading row delete. A
    // storage object does not follow a database foreign key automatically.
    const [{ data: dates }, { data: orders }, { data: reviews }] = await Promise.all([
      supabase.from("circle_members").select("photo_paths").eq("customer_id", customer.id),
      supabase.from("orders").select("inspiration_photo_url").eq("customer_id", customer.id),
      supabase.from("community_reviews").select("id, photo_paths").eq("customer_id", customer.id),
    ]);
    const inspirationPaths = [
      ...(dates || []).flatMap((date) => storagePaths(date.photo_paths)),
      ...(orders || []).flatMap((order) => String(order.inspiration_photo_url || "").split(",").filter(Boolean)),
    ].filter((path, index, all) => storagePaths([path]).length === 1 && all.indexOf(path) === index);
    const reviewPaths = (reviews || []).flatMap((review) => storagePaths(review.photo_paths));

    await Promise.allSettled([
      inspirationPaths.length ? supabase.storage.from("inspiration-photos").remove(inspirationPaths) : Promise.resolve(),
      reviewPaths.length ? supabase.storage.from("community-review-photos").remove(reviewPaths) : Promise.resolve(),
      reviews?.length ? supabase.from("community_reviews").delete().eq("customer_id", customer.id) : Promise.resolve(),
    ]);

    // Keep the minimum tax and payment record, but remove delivery, cake and
    // uploaded-content details that are not needed once the account is gone.
    await supabase.from("orders").update({
      cake_flavour: null,
      cake_description: null,
      cake_photo_url: null,
      inspiration_photo_url: null,
      number_of_people: null,
      colours_and_themes: null,
      delivery_address: null,
    }).eq("customer_id", customer.id);

    const { error: rowError } = await supabase.from("customers").delete().eq("id", customer.id);
    if (rowError) return json({ error: "Could not delete your details" }, 500);

    // Profile photos are private customer data, not business records. Remove
    // the storage object alongside the customer row. A failed storage cleanup
    // must not block the legal right to erase the account itself.
    if (customer.profile_image_path) {
      await supabase.storage.from("customer-profile-images").remove([customer.profile_image_path]);
    }
  }

  // Last, because losing the auth user before the row would strand the row with
  // no way for its owner to reach it again.
  const { error: userError } = await supabase.auth.admin.deleteUser(auth.user.id);
  if (userError) return json({ error: "Could not close your sign in" }, 500);

  // This is purposefully not linked to an identity. A person can help Hazel
  // improve the service without their deletion survey becoming retained PII.
  // It is optional, so a logging failure never prevents account deletion.
  if (reason || feedback) {
    await supabase.from("account_deletion_feedback").insert({ reason: reason || null, feedback: feedback || null });
  }

  await notify(
    supabase,
    "account_deleted",
    "A customer deleted their account. Their identifiable account data and uploads were removed; necessary tax records may remain.",
    "high",
  );

  return json({ deleted: true });
});
