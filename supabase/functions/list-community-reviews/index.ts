// Public Community wall. It exposes only reviews that Hazel has approved and
// received permission to feature. Private storage photos receive short URLs.
import { adminClient, corsHeaders, json } from "../_shared/client.ts";

interface ReviewRow {
  id: string;
  rating: number;
  display_name: string;
  cake_or_bake: string | null;
  comment: string;
  photo_paths: string[] | null;
  created_at: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = adminClient();
  const { data, error } = await supabase
    .from("community_reviews")
    .select("id, rating, display_name, cake_or_bake, comment, photo_paths, created_at")
    .eq("status", "approved")
    .eq("public_consent", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) return json({ error: "Community reviews are unavailable just now." }, 500);

  const reviews = await Promise.all(((data || []) as ReviewRow[]).map(async (review) => {
    const paths = Array.isArray(review.photo_paths) ? review.photo_paths : [];
    const { data: urls } = paths.length
      ? await supabase.storage.from("community-review-photos").createSignedUrls(paths, 60 * 60)
      : { data: [] as { path: string; signedUrl: string | null }[] };
    const photoUrls = (urls || []).map((item) => item.signedUrl).filter((url): url is string => Boolean(url));
    return {
      id: review.id,
      rating: review.rating,
      display_name: review.display_name,
      cake_or_bake: review.cake_or_bake,
      comment: review.comment,
      photo_urls: photoUrls,
      created_at: review.created_at,
    };
  }));

  return json({ reviews });
});
