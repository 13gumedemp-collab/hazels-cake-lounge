import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, COOKIE } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

// Removing a prospect is deliberately limited to an untouched new enquiry.
// A customer's account and their other occasions always remain intact.
export async function DELETE(req: NextRequest) {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!(await verifySession(token))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  if (!orderId) return NextResponse.json({ error: "An enquiry is required." }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: order, error: findError } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", orderId)
    .maybeSingle();
  if (findError || !order) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
  if (order.status !== "enquiry") {
    return NextResponse.json({ error: "Only new enquiries can be removed as prospects." }, { status: 409 });
  }

  const { error: deleteError } = await supabase.from("orders").delete().eq("id", order.id);
  if (deleteError) return NextResponse.json({ error: "The prospect could not be removed." }, { status: 500 });
  return NextResponse.json({ status: "ok" });
}
