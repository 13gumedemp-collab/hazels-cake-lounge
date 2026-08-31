import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { hashAdminPassword, verifyAdminPassword } from "@/lib/adminPassword";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "");
  const sb = supabaseAdmin();

  if (action === "business" || action === "reminders") {
    const value = body.value && typeof body.value === "object" ? body.value : null;
    if (!value) return NextResponse.json({ error: "Settings value required" }, { status: 400 });
    const { error } = await sb.from("app_settings").upsert({ key: action, value, updated_at: new Date().toISOString() });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ message: "Settings saved." });
  }

  if (action === "template") {
    const value = body.value || {};
    const templateName = String(value.template_name || "");
    const subject = String(value.subject || "");
    const templateBody = String(value.body || "");
    if (!templateName || !subject || !templateBody) return NextResponse.json({ error: "Template, subject and body are required" }, { status: 400 });
    const { error } = await sb.from("message_templates").update({ subject, body: templateBody }).eq("template_name", templateName);
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ message: "Template saved." });
  }

  if (action === "password") {
    const current = String(body.current_password || "");
    const next = String(body.new_password || "");
    if (!(await verifyAdminPassword(current))) return NextResponse.json({ error: "The current password is not correct." }, { status: 400 });
    if (next.length < 12) return NextResponse.json({ error: "Use at least 12 characters." }, { status: 400 });
    const { error } = await sb.from("app_settings").upsert({ key: "admin_auth", value: { password_hash: hashAdminPassword(next) }, updated_at: new Date().toISOString() });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ message: "Admin password changed." });
  }

  if (action === "test_email") {
    const { data, error } = await sb.functions.invoke("send-test-email", { body: { source: "admin" } });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    if (data?.status === "failed") return NextResponse.json({ error: data.error || "Delivery test failed" }, { status: 502 });
    return NextResponse.json({ message: "Test email sent to the protected business inbox." });
  }

  return NextResponse.json({ error: "Unknown settings action" }, { status: 400 });
}
