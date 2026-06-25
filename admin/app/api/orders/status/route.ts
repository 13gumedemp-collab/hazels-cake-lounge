import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession, COOKIE } from "@/lib/auth";

// Moves an order through the pipeline by calling the update-order-status edge
// function (which also fires invoices, memory cards and notifications).
export async function POST(req: NextRequest) {
  const token = cookies().get(COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { order_id, new_status } = await req.json().catch(() => ({}));
  if (!order_id || !new_status) {
    return NextResponse.json({ error: "order_id and new_status are required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Server not configured" }, { status: 500 });

  try {
    const r = await fetch(`${url}/functions/v1/update-order-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ order_id, new_status }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) return NextResponse.json(out, { status: r.status });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "Could not reach the order service" }, { status: 502 });
  }
}
