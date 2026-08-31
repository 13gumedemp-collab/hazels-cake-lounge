import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  const protocol = request.headers.get("x-forwarded-proto") || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return origin === `${protocol}://${host}`;
}

// Every dashboard mutation uses the HttpOnly admin cookie. This guard adds a
// same-origin check before any route can act on that cookie, closing the CSRF
// path even if a browser's SameSite behaviour changes.
export function proxy(request: NextRequest) {
  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
