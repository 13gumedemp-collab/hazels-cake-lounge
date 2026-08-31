import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

const ACTION_STATUS = {
  approve: "approved",
  keep_private: "private",
  reject: "rejected",
} as const;

export async function POST(req: NextRequest) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = String(body.action || "") as keyof typeof ACTION_STATUS;
  if (!id || !(action in ACTION_STATUS)) return NextResponse.json({ error: "A review and moderation action are required." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: review, error: findError } = await supabase
    .from("community_reviews")
    .select("id, public_consent, status")
    .eq("id", id)
    .maybeSingle();
  if (findError || !review) return NextResponse.json({ error: "Review not found." }, { status: 404 });
  if (action === "approve" && !review.public_consent) {
    return NextResponse.json({ error: "This reviewer did not give permission for public sharing. Keep it private instead." }, { status: 400 });
  }

  const status = ACTION_STATUS[action];
  const { error: updateError } = await supabase
    .from("community_reviews")
    .update({ status, moderated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  return NextResponse.json({ status });
}
