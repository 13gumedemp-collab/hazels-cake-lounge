// Saves one private profile image for the signed-in customer. The page receives
// a short-lived URL only for its own preview. Community visibility is a separate
// choice made on each review.
import { adminClient, corsHeaders, json } from "../_shared/client.ts";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function extensionFor(mime: string): string | null {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[mime] || null;
}

function decodeImage(value: string): { bytes: Uint8Array; mime: string; extension: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[2]), (character) => character.charCodeAt(0));
    const extension = extensionFor(match[1]);
    if (!extension || !bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, mime: match[1], extension };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Please sign in before changing your profile photo." }, 401);
  const supabase = adminClient();
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return json({ error: "Please sign in before changing your profile photo." }, 401);
  const { data: customer } = await supabase
    .from("customers")
    .select("id, profile_image_path")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  if (!customer) return json({ error: "Your account is still being prepared. Please try again." }, 409);

  const body = await req.json().catch(() => ({}));
  const oldPath = customer.profile_image_path || null;
  if (body.remove === true) {
    const { error } = await supabase.from("customers").update({ profile_image_path: null }).eq("id", customer.id);
    if (error) return json({ error: "I could not remove your profile photo just yet." }, 500);
    if (oldPath) await supabase.storage.from("customer-profile-images").remove([oldPath]);
    return json({ profile_image_path: null, url: null });
  }

  const image = decodeImage(String(body.data_url || ""));
  if (!image) return json({ error: "Choose a JPEG, PNG or WebP photo no larger than 2 MB." }, 400);
  const path = `${customer.id}/profile-${Date.now()}.${image.extension}`;
  const { error: uploadError } = await supabase.storage
    .from("customer-profile-images")
    .upload(path, image.bytes, { contentType: image.mime, upsert: false });
  if (uploadError) return json({ error: "I could not upload that photo. Please try again." }, 500);

  const { error: saveError } = await supabase.from("customers").update({ profile_image_path: path }).eq("id", customer.id);
  if (saveError) {
    await supabase.storage.from("customer-profile-images").remove([path]);
    return json({ error: "I could not save that photo to your account." }, 500);
  }
  if (oldPath) await supabase.storage.from("customer-profile-images").remove([oldPath]);
  const { data: signed } = await supabase.storage.from("customer-profile-images").createSignedUrl(path, 60 * 60);
  return json({ profile_image_path: path, url: signed?.signedUrl || null });
});
