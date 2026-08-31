import CommunityReviewModeration, { CommunityReview } from "@/components/CommunityReviewModeration";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type ReviewRow = Omit<CommunityReview, "photoUrls"> & { photo_paths: string[] | null };

export default async function CommunityPage() {
  const supabase = supabaseAdmin();
  const { data } = await supabase
    .from("community_reviews")
    .select("id, rating, reviewer_name, display_name, cake_or_bake, comment, photo_paths, public_consent, status, source, created_at, moderated_at, customer:customers(id, full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);

  const reviews = await Promise.all(((data || []) as unknown as ReviewRow[]).map(async (review) => {
    const paths = Array.isArray(review.photo_paths) ? review.photo_paths : [];
    const { data: signed } = paths.length
      ? await supabase.storage.from("community-review-photos").createSignedUrls(paths, 60 * 60)
      : { data: [] as { signedUrl: string | null }[] };
    return {
      ...review,
      photoUrls: (signed || []).map((file) => file.signedUrl).filter((url): url is string => Boolean(url)),
    };
  }));

  const pending = reviews.filter((review) => review.status === "pending").length;
  const approved = reviews.filter((review) => review.status === "approved").length;
  return (
    <div className="admin-page max-w-6xl mx-auto">
      <div className="page-heading flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="eyebrow">Pamphlet and website feedback</p>
          <h1>Community Reviews</h1>
          <p className="text-creamSoft mt-2">Guests can leave a review without an account. Nothing is public until you approve a consented review.</p>
        </div>
        <span>{pending} waiting</span>
      </div>
      <div className="community-summary mt-6">
        <div><strong>{pending}</strong><span>waiting for review</span></div>
        <div><strong>{approved}</strong><span>featured publicly</span></div>
        <div><strong>{reviews.length}</strong><span>reviews received</span></div>
      </div>
      <CommunityReviewModeration initialReviews={reviews} />
    </div>
  );
}
