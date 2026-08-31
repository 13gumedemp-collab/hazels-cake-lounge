"use client";

import { useMemo, useState } from "react";

export interface CommunityReview {
  id: string;
  rating: number;
  reviewer_name: string | null;
  display_name: string;
  cake_or_bake: string | null;
  comment: string;
  photo_paths: string[] | null;
  photoUrls: string[];
  public_consent: boolean;
  status: "pending" | "approved" | "private" | "rejected";
  source: "community_page" | "pamphlet_qr";
  created_at: string;
  moderated_at: string | null;
  customer: { id: string; full_name: string; email: string } | null;
}

type Filter = "pending" | "approved" | "private" | "rejected" | "all";

function dateTime(value: string) {
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
}

export default function CommunityReviewModeration({ initialReviews }: { initialReviews: CommunityReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const visible = useMemo(
    () => reviews.filter((review) => filter === "all" || review.status === filter),
    [filter, reviews],
  );

  async function moderate(id: string, action: "approve" | "keep_private" | "reject") {
    setBusy(id);
    setNotice("");
    try {
      const response = await fetch("/api/community-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Could not update that review.");
      setReviews((current) => current.map((review) => review.id === id
        ? { ...review, status: result.status, moderated_at: new Date().toISOString() }
        : review));
      setNotice(action === "approve" ? "Review is now visible on the Community page." : action === "keep_private" ? "Review saved privately." : "Review rejected and kept off the Community page.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update that review.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="community-moderation mt-5" aria-label="Community review moderation">
      <div className="task-tabs">
        {(["pending", "approved", "private", "rejected", "all"] as Filter[]).map((item) => (
          <button type="button" key={item} className={filter === item ? "is-active" : ""} onClick={() => setFilter(item)}>
            {item === "all" ? "All" : item[0].toUpperCase() + item.slice(1)} ({item === "all" ? reviews.length : reviews.filter((review) => review.status === item).length})
          </button>
        ))}
      </div>
      {notice && <p className="community-notice" role="status">{notice}</p>}
      {visible.length === 0 ? (
        <div className="surface-card surface-card--empty mt-5 p-10 text-center"><p className="text-creamSoft">There are no {filter === "all" ? "Community reviews" : `${filter} reviews`} here.</p></div>
      ) : (
        <div className="community-review-grid mt-5">
          {visible.map((review) => (
            <article className="community-review surface-card" key={review.id}>
              <header>
                <div>
                  <p className="eyebrow">{review.source === "pamphlet_qr" ? "Pamphlet QR" : "Community page"}</p>
                  <h2>{review.reviewer_name || review.customer?.full_name || "Guest reviewer"}</h2>
                  <p className="community-review__stars" aria-label={`${review.rating} out of 5`}>{stars(review.rating)}</p>
                </div>
                <time>{dateTime(review.created_at)}</time>
              </header>
              <p className="community-review__comment">{review.comment}</p>
              {review.cake_or_bake && <p className="community-review__bake">{review.cake_or_bake}</p>}
              <div className="community-review__meta">
                <span>{review.public_consent ? `Can feature as ${review.display_name}` : "No permission to feature publicly"}</span>
                {review.customer && <span>Connected to {review.customer.email}</span>}
              </div>
              {review.photoUrls.length > 0 && <div className="community-review__photos">
                {review.photoUrls.map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}><img src={url} alt={`Customer cake photo ${index + 1}`} /></a>)}
              </div>}
              {review.status === "pending" && <div className="community-review__actions">
                <button type="button" className="is-primary" disabled={busy === review.id || !review.public_consent} onClick={() => moderate(review.id, "approve")}>{busy === review.id ? "Saving..." : "Approve and feature"}</button>
                <button type="button" disabled={busy === review.id} onClick={() => moderate(review.id, "keep_private")}>Keep private</button>
                <button type="button" className="is-danger" disabled={busy === review.id} onClick={() => moderate(review.id, "reject")}>Reject</button>
              </div>}
              {review.status !== "pending" && <p className="community-review__state">{review.status === "approved" ? "Featured on Community" : review.status === "private" ? "Saved privately" : "Rejected"}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
