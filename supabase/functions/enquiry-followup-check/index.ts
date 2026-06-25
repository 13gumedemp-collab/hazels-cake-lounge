// enquiry-followup-check  (run hourly by pg_cron)
// Finds enquiry orders that are more than 24 hours old and still sitting at
// status 'enquiry'. For each, emails Hazel the hazel_followup_nudge and raises
// a high-priority (red) notification. Deduped per occasion via reminder_log.
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
    .select(`id, occasion_id, created_at,
             customer:customers ( full_name, email ),
             occasion:occasions ( person_name, occasion_type, occasion_date )`)
    .eq("status", "enquiry")
    .lte("created_at", cutoff);

  // Which occasions already got a nudge.
  const { data: nudged } = await supabase
    .from("reminder_log")
    .select("occasion_id")
    .eq("reminder_type", "followup_nudge");
  const done = new Set((nudged ?? []).map((n) => n.occasion_id));

  let sent = 0;
  for (const o of orders ?? []) {
    if (o.occasion_id && done.has(o.occasion_id)) continue;
    const c = o.customer as { full_name: string; email: string } | null;
    const occ = o.occasion as { person_name: string; occasion_type: string; occasion_date: string } | null;
    if (!c) continue;

    const vars = {
      ...biz,
      customer_name: c.full_name,
      person_name: occ?.person_name ?? "",
      occasion_type: occ?.occasion_type ?? "",
      occasion_date: occ?.occasion_date ?? "",
    };
    const r = await sendToAddress(businessEmail, "hazel_followup_nudge", vars, supabase);
    await supabase.from("reminder_log").insert({
      occasion_id: o.occasion_id, reminder_type: "followup_nudge",
      channel: "email", status: r.status === "sent" ? "sent" : "failed",
      error_message: r.error ?? null,
    });
    await notify(supabase, "enquiry_overdue_reply",
      `RED: ${c.full_name} sent an enquiry over 24 hours ago and has not had a reply.`);
    sent++;
    if (o.occasion_id) done.add(o.occasion_id);
  }

  return json({ status: "ok", nudges_sent: sent });
});
