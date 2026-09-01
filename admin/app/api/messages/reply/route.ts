import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

export async function POST(req: NextRequest) {
  if (!(await verifySession((await cookies()).get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const threadId = String(body.thread_id || "");
  const text = String(body.text || "").trim();
  if (!threadId || !text) return NextResponse.json({ error: "Thread and reply are required" }, { status: 400 });
  if (text.length > 10000) return NextResponse.json({ error: "Please keep the reply under 10,000 characters" }, { status: 400 });

  const sb = supabaseAdmin();
  const [{ data: thread }, { data: latestInbound }] = await Promise.all([
    sb.from("email_threads").select("id, customer_id, contact_email, contact_name, subject").eq("id", threadId).maybeSingle(),
    sb.from("email_messages")
      .select("internet_message_id, references_header")
      .eq("thread_id", threadId)
      .eq("direction", "inbound")
      .not("internet_message_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!thread) return NextResponse.json({ error: "Email thread not found" }, { status: 404 });

  const references = Array.from(new Set([
    ...((latestInbound?.references_header as string[] | null) || []),
    latestInbound?.internet_message_id || "",
  ].filter(Boolean))).slice(-30);
  const subject = /^re:/i.test(thread.subject) ? thread.subject : `Re: ${thread.subject}`;
  const { data, error } = await sb.functions.invoke("send-email", {
    body: {
      customer_id: thread.customer_id,
      to_address: thread.contact_email,
      contact_name: thread.contact_name,
      thread_id: thread.id,
      subject,
      text,
      essential: true,
      reminder_type: "conversation_reply",
      in_reply_to: latestInbound?.internet_message_id || null,
      references,
    },
  });
  if (error) return NextResponse.json({ status: "failed", error: error.message }, { status: 502 });
  if (data?.status !== "sent") return NextResponse.json(data || { status: "failed", error: "Reply was not sent" }, { status: 502 });

  await sb.from("email_threads").update({ unread_count: 0, status: "open", updated_at: new Date().toISOString() }).eq("id", threadId);
  return NextResponse.json(data);
}
