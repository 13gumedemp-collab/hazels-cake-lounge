// Public Community wall. It exposes only reviews that Hazel has approved and
// received permission to feature. Private storage photos receive short URLs.
import { adminClient, browserJson, browserPreflight, isAllowedBrowserOrigin } from "../_shared/client.ts";

interface ReviewRow {
  id: string;
  rating: number;
  display_name: string;
  cake_or_bake: string | null;
  comment: string;
  photo_paths: string[] | null;
  show_profile_image: boolean;
  customer: { profile_image_path: string | null } | null;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return browserPreflight(req);
  if (!isAllowedBrowserOrigin(req)) return browserJson(req, { error: "Forbidden" }, 403);
  if (req.method !== "POST") return browserJson(req, { error: "Method not allowed" }, 405);

  const supabase = adminClient();
  const { data, error } = await supabase
    .from("community_reviews")
    .select("id, rating, display_name, cake_or_bake, comment, photo_paths, show_profile_image, customer:customers(profile_image_path), created_at")
    .eq("status", "approved")
    .eq("public_consent", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return browserJson(req, { error: "Community reviews are unavailable just now." }, 500);

  const reviews = await Promise.all(((data || []) as ReviewRow[]).map(async (review) => {
    const paths = Array.isArray(review.photo_paths) ? review.photo_paths : [];
    const { data: urls } = paths.length
      ? await supabase.storage.from("community-review-photos").createSignedUrls(paths, 60 * 60)
      : { data: [] as { path: string; signedUrl: string | null }[] };
    const photoUrls = (urls || []).map((item) => item.signedUrl).filter((url): url is string => Boolean(url));
    const profilePath = review.show_profile_image ? review.customer?.profile_image_path : null;
    const { data: profile } = profilePath
      ? await supabase.storage.from("customer-profile-images").createSignedUrl(profilePath, 60 * 60)
      : { data: null as { signedUrl: string | null } | null };
    return {
      id: review.id,
      rating: review.rating,
      display_name: review.display_name,
      cake_or_bake: review.cake_or_bake,
      comment: review.comment,
      photo_urls: photoUrls,
      profile_image_url: profile?.signedUrl || null,
      created_at: review.created_at,
    };
  }));

  return browserJson(req, { reviews });
});
