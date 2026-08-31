import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "./supabaseServer";

function fingerprint(request: NextRequest): string {
  const forwarded = request.headers.get("x-vercel-forwarded-for") || request.headers.get("x-forwarded-for") || "";
  const source = forwarded.split(",")[0].trim() || request.headers.get("user-agent") || "unknown";
  return createHash("sha256").update(`admin_login:${source}`).digest("hex");
}

export async function consumeAdminLoginLimit(request: NextRequest): Promise<{
  available: boolean;
  allowed: boolean;
  retryAfterSeconds: number;
}> {
  const { data, error } = await supabaseAdmin().rpc("consume_request_rate_limit", {
    p_scope: "admin_login",
    p_fingerprint: fingerprint(request),
    p_limit: 5,
    p_window_seconds: 15 * 60,
  });
  if (error) return { available: false, allowed: false, retryAfterSeconds: 0 };
  const row = Array.isArray(data) ? data[0] : data;
  return {
    available: true,
    allowed: row?.allowed === true,
    retryAfterSeconds: Number(row?.retry_after_seconds || 0),
  };
}
