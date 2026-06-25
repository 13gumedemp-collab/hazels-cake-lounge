// enquiry-followup-check  (hourly via pg_cron)
// Enquiry orders older than 24h still at status 'enquiry' -> email Hazel the
// nudge and raise a red notification. Deduped per circle_member.
import { adminClient, businessVars, corsHeaders, json, notify } from "../_shared/client.ts";
import { sendToAddress } from "../_shared/email.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();
  const biz = businessVars();
  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const { data: orders } = await supabase
    .from("orders")
    .select(`id, circle_member_id, created_at,
             customer:customers ( full_name, email ),
             circle_member:circle_members ( person_name, occasion_type, occasion_date )`)
    .eq("status", "enquiry").lte("created_at", cutoff);

  const { data: nudged } = await supabase
    .from("reminder_log").select("circle_member_id").eq("reminder_type", "followup_nudge");
  const done = new Set((nudged ?? []).map((n) => n.circle_member_id));

  let sent = 0;
  for (const o of orders ?? []) {
    if (o.circle_member_id && done.has(o.circle_member_id)) continue;
    const c = o.customer as { full_name: string; email: string } | null;
    const cm = o.circle_member as { person_name: string; occasion_type: string; occasion_date: string } | null;
    if (!c) continue;
    const r = await sendToAddress(businessEmail, "hazel_followup_nudge", {
      ...biz, customer_name: c.full_name, person_name: cm?.person_name ?? "",
      occasion_type: cm?.occasion_type ?? "", occasion_date: cm?.occasion_date ?? "",
    }, supabase);
    await supabase.from("reminder_log").insert({
      circle_member_id: o.circle_member_id, reminder_type: "followup_nudge", channel: "email",
      status: r.status === "sent" ? "sent" : "failed", error_message: r.error ?? null,
      year_sent: new Date(Date.now() + 2 * 3600 * 1000).getUTCFullYear(),
    });
    await notify(supabase, "enquiry_overdue_reply",
      `${c.full_name} sent an enquiry over 24 hours ago and has not had a reply.`, "high", "/orders");
    sent++;
    if (o.circle_member_id) done.add(o.circle_member_id);
  }
  return json({ status: "ok", nudges_sent: sent });
});
