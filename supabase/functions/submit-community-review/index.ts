// Public Community review intake. An account can enrich a review, but is never
// required. Every submission starts in moderation and photos remain private.
import { adminClient, corsHeaders, json, notify } from "../_shared/client.ts";

const MAX_PHOTOS = 3;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;

interface PhotoPayload {
  data_url?: string;
}

interface Payload {
  rating?: number;
  name?: string;
  cake_or_bake?: string;
  comment?: string;
  public_consent?: boolean;
  show_name?: boolean;
  show_first_name?: boolean;
  show_profile_image?: boolean;
  source?: string;
  photos?: PhotoPayload[];
}

function clean(value: unknown, max: number): string {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function extensionFor(mime: string): string | null {
  return ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[mime] || null;
}

function decodePhoto(value: string): { bytes: Uint8Array; mime: string; extension: string } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const extension = extensionFor(match[1]);
    if (!extension || !bytes.length || bytes.length > MAX_IMAGE_BYTES) return null;
    return { bytes, mime: match[1], extension };
  } catch {
    return null;
  }
}

async function fingerprintFor(req: Request): Promise<string> {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const stableValue = forwarded || req.headers.get("cf-connecting-ip") || req.headers.get("user-agent") || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableValue));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function withinRateLimit(supabase: ReturnType<typeof adminClient>, fingerprint: string): Promise<boolean> {
  const now = Date.now();
  const { data: current, error } = await supabase
    .from("community_review_rate_limits")
    .select("window_started_at, submission_count")
    .eq("fingerprint", fingerprint)
    .maybeSingle();
  if (error) return false;

  if (!current || now - new Date(current.window_started_at).getTime() >= WINDOW_MS) {
    const { error: upsertError } = await supabase.from("community_review_rate_limits").upsert({
      fingerprint,
      window_started_at: new Date(now).toISOString(),
      submission_count: 1,
      updated_at: new Date(now).toISOString(),
    });
    return !upsertError;
  }
  if (current.submission_count >= 3) return false;
  const { error: updateError } = await supabase
    .from("community_review_rate_limits")
    .update({ submission_count: current.submission_count + 1, updated_at: new Date(now).toISOString() })
    .eq("fingerprint", fingerprint);
  return !updateError;
}

async function linkedCustomer(supabase: ReturnType<typeof adminClient>, token: string | null): Promise<{ id: string; profile_image_path: string | null } | null> {
  if (!token) return null;
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return null;
  const { data: customer } = await supabase
    .from("customers")
    .select("id, profile_image_path")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  return customer || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: Payload;
  try { payload = await req.json(); } catch { return json({ error: "Please try again with a valid review." }, 400); }

  const rating = Number(payload.rating);
  const name = clean(payload.name, 80);
  const cakeOrBake = clean(payload.cake_or_bake, 100);
  const comment = clean(payload.comment, 2000);
  const photos = Array.isArray(payload.photos) ? payload.photos : [];
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return json({ error: "Please choose a rating out of five." }, 400);
  if (comment.length < 5) return json({ error: "Please add a few words about your experience." }, 400);
  if (photos.length > MAX_PHOTOS) return json({ error: "You can add up to three photos." }, 400);

  const decodedPhotos = photos.map((photo) => decodePhoto(String(photo?.data_url || "")));
  if (decodedPhotos.some((photo) => !photo)) {
    return json({ error: "Photos must be JPEG, PNG or WebP and no larger than 2 MB each." }, 400);
  }

  const supabase = adminClient();
  if (!(await withinRateLimit(supabase, await fingerprintFor(req)))) {
    return json({ error: "Please wait a few minutes before sending another review." }, 429);
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const customer = await linkedCustomer(supabase, bearer);
  const showName = payload.show_name ?? payload.show_first_name ?? false;
  const displayName = showName && name ? name : "A happy customer";
  const source = payload.source === "pamphlet_qr" ? "pamphlet_qr" : "community_page";
  const { data: review, error: reviewError } = await supabase
    .from("community_reviews")
    .insert({
      customer_id: customer?.id ?? null,
      rating,
      reviewer_name: name || null,
      display_name: displayName,
      cake_or_bake: cakeOrBake || null,
      comment,
      public_consent: payload.public_consent === true,
      show_profile_image: payload.show_profile_image === true && Boolean(customer?.profile_image_path),
      source,
    })
    .select("id")
    .single();
  if (reviewError || !review) return json({ error: "I could not save your review just yet. Please try again." }, 500);

  const paths: string[] = [];
  try {
    for (const [index, photo] of decodedPhotos.entries()) {
      const path = `reviews/${review.id}/${index + 1}.${photo!.extension}`;
      const { error: uploadError } = await supabase.storage
        .from("community-review-photos")
        .upload(path, photo!.bytes, { contentType: photo!.mime, upsert: false });
      if (uploadError) throw uploadError;
      paths.push(path);
    }
    if (paths.length) {
      const { error: updateError } = await supabase.from("community_reviews").update({ photo_paths: paths }).eq("id", review.id);
      if (updateError) throw updateError;
    }
  } catch {
    if (paths.length) await supabase.storage.from("community-review-photos").remove(paths);
    await supabase.from("community_reviews").delete().eq("id", review.id);
    return json({ error: "I could not add those photos. Please try again without them or choose smaller images." }, 500);
  }

  await notify(
    supabase,
    "community_review_submitted",
    `A new ${rating}-star Community review from ${displayName} is waiting for approval.`,
    "standard",
    "/community",
  );
  return json({ status: "pending", id: review.id });
});
