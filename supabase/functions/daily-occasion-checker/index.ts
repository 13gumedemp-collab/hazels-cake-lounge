// daily-occasion-checker  (run by pg_cron at 08:00 SAST)
//
// For every recurring occasion, works out the next occurrence and triggers:
//   30 days before -> reminder_one_month (email)
//   14 days before -> reminder_two_weeks (email)
//    7 days before -> reminder_one_week  (email)
//   +2 days after  -> post_celebration   (email)
//   own_birthday   -> birthday_surprise  (email)
// WhatsApp is manual: at 1 month and 1 week we queue a task in
// whatsapp_reminders_due for Hazel to send by hand (no Twilio).
//
// 1 January: reset every recurring occasion to the new year's date and email
// each customer a yearly_summary of their occasions.
//
// Duplicate prevention: a reminder type is only sent once per occasion per
// calendar year. A repeat attempt is logged as duplicate_skipped.
import { adminClient, businessVars, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail, sendToAddress } from "../_shared/email.ts";

const EMAIL_TEMPLATE: Record<string, string> = {
  one_month: "reminder_one_month",
  two_weeks: "reminder_two_weeks",
  one_week: "reminder_one_week",
  post_celebration: "post_celebration",
};
const DAY = 86_400_000;

function sastToday() {
  const now = new Date();
  const s = new Date(now.getTime() + 2 * 3600 * 1000);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate(),
           date: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())) };
}
function md(dateStr: string) {
  const [, mm, dd] = dateStr.split("-").map(Number);
  return { m: mm - 1, d: dd };
}
function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function ymd(y: number, m: number, d: number) {
  if (m === 1 && d === 29 && !isLeap(y)) d = 28; // Feb 29 guard
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function prettyDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}
function waCopy(type: string, v: Record<string, string>) {
  if (type === "one_month") {
    return `Hi ${v.first_name}, it is Hazel from Hazel's Cake Lounge. Just a friendly heads up that ${v.person_name}'s ${v.occasion_type} is coming up in about a month. I would love to bake something special again. Pop me a message whenever you are ready to chat.`;
  }
  return `Hi ${v.first_name}, Hazel here. Just one week until ${v.person_name}'s ${v.occasion_type}. My diary is filling up for that week so let me know if you would like to place an order. Here is the link to enquire: ${v.enquiry_url}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();
  const today = sastToday();
  const biz = businessVars();
  let emails = 0, waTasks = 0, failures = 0, dupes = 0;

  // Year-to-date log for dedupe.
  const { data: logs } = await supabase
    .from("reminder_log")
    .select("occasion_id, reminder_type, customer_id, status")
    .gte("sent_at", `${today.year}-01-01`);
  const handled = new Set(
    (logs ?? []).filter((l) => l.status !== "failed" && l.status !== "duplicate_skipped")
      .map((l) => `${l.occasion_id ?? "x"}|${l.reminder_type}`),
  );
  const birthdayDone = new Set(
    (logs ?? []).filter((l) => l.reminder_type === "birthday_surprise" && l.status === "sent")
      .map((l) => l.customer_id),
  );
  // Existing WhatsApp tasks this year (dedupe).
  const { data: waRows } = await supabase
    .from("whatsapp_reminders_due")
    .select("occasion_id, reminder_type, created_at")
    .gte("created_at", `${today.year}-01-01`);
  const waHandled = new Set((waRows ?? []).map((r) => `${r.occasion_id}|${r.reminder_type}`));

  const { data: occasions } = await supabase
    .from("occasions")
    .select(`id, person_name, occasion_type, occasion_date, customer_id,
             customer:customers ( id, full_name, email_consent, whatsapp_consent, whatsapp_number )`)
    .eq("recurring_yearly", true);

  for (const occ of occasions ?? []) {
    const c = occ.customer as {
      id: string; full_name: string; email_consent: boolean;
      whatsapp_consent: boolean; whatsapp_number: string | null;
    } | null;
    if (!c) continue;

    const { m, d } = md(occ.occasion_date);
    const thisYear = new Date(Date.UTC(today.year, m, d));
    const next = thisYear.getTime() >= today.date.getTime() ? thisYear : new Date(Date.UTC(today.year + 1, m, d));
    const last = thisYear.getTime() <= today.date.getTime() ? thisYear : new Date(Date.UTC(today.year - 1, m, d));
    const daysUntil = Math.round((next.getTime() - today.date.getTime()) / DAY);
    const daysSince = Math.round((today.date.getTime() - last.getTime()) / DAY);

    let type: string | null = null;
    if (daysUntil === 30) type = "one_month";
    else if (daysUntil === 14) type = "two_weeks";
    else if (daysUntil === 7) type = "one_week";
    else if (daysSince === 2) type = "post_celebration";
    if (!type) continue;

    const vars: Record<string, string> = {
      ...biz,
      first_name: firstName(c.full_name),
      person_name: occ.person_name,
      occasion_type: occ.occasion_type,
      occasion_date: occ.occasion_date,
    };

    // Email reminder
    if (handled.has(`${occ.id}|${type}`)) {
      await supabase.from("reminder_log").insert({
        customer_id: c.id, occasion_id: occ.id, reminder_type: type,
        channel: "email", status: "duplicate_skipped",
      });
      dupes++;
    } else if (c.email_consent !== false) {
      const r = await sendEmail(supabase, {
        customer_id: c.id, template_name: EMAIL_TEMPLATE[type],
        reminder_type: type, occasion_id: occ.id, dynamic_variables: vars,
      });
      if (r.status === "sent") emails++; else if (r.status === "failed") failures++;
      handled.add(`${occ.id}|${type}`);
    }

    // WhatsApp manual task (one month + one week only)
    if ((type === "one_month" || type === "one_week") &&
        c.whatsapp_consent && c.whatsapp_number && !waHandled.has(`${occ.id}|${type}`)) {
      await supabase.from("whatsapp_reminders_due").insert({
        customer_id: c.id, occasion_id: occ.id, reminder_type: type,
        whatsapp_number: c.whatsapp_number, message_copy: waCopy(type, vars),
        due_date: next.toISOString().slice(0, 10), status: "pending",
      });
      await notify(supabase, "whatsapp_due",
        `WhatsApp ${type.replace("_", " ")} reminder due for ${c.full_name} (${occ.person_name}'s ${occ.occasion_type})`);
      waTasks++;
      waHandled.add(`${occ.id}|${type}`);
    }
  }

  // Birthdays
  const { data: bdays } = await supabase
    .from("customers")
    .select("id, full_name, email_consent, own_birthday")
    .not("own_birthday", "is", null);
  for (const c of bdays ?? []) {
    const { m, d } = md(c.own_birthday as string);
    if (m !== today.month || d !== today.day || birthdayDone.has(c.id) || c.email_consent === false) continue;
    const r = await sendEmail(supabase, {
      customer_id: c.id, template_name: "birthday_surprise",
      reminder_type: "birthday_surprise",
      dynamic_variables: { ...biz, first_name: firstName(c.full_name) },
    });
    if (r.status === "sent") emails++; else if (r.status === "failed") failures++;
  }

  // ---- 1 January: yearly reset + summary --------------------------------
  let yearlyReset = 0, summaries = 0;
  if (today.month === 0 && today.day === 1) {
    // Reset recurring occasion dates to the new year.
    for (const occ of occasions ?? []) {
      const { m, d } = md(occ.occasion_date);
      await supabase.from("occasions").update({ occasion_date: ymd(today.year, m, d) }).eq("id", occ.id);
      yearlyReset++;
    }
    // Summary email per customer (dedupe via reminder_log).
    const summaryDone = new Set(
      (logs ?? []).filter((l) => l.reminder_type === "yearly_summary" && l.status === "sent")
        .map((l) => l.customer_id),
    );
    const { data: customers } = await supabase
      .from("customers")
      .select(`id, full_name, email_consent,
               occasions ( person_name, occasion_type, occasion_date, recurring_yearly )`);
    for (const cust of customers ?? []) {
      if (cust.email_consent === false || summaryDone.has(cust.id)) continue;
      const occ = (cust.occasions as { person_name: string; occasion_type: string; occasion_date: string; recurring_yearly: boolean }[] | null) ?? [];
      const recurring = occ.filter((o) => o.recurring_yearly)
        .sort((a, b) => a.occasion_date.localeCompare(b.occasion_date));
      if (recurring.length === 0) continue;
      const list = recurring
        .map((o) => `<p style="margin:4px 0"><b>${o.person_name}'s ${o.occasion_type}</b> on ${prettyDate(ymd(today.year, md(o.occasion_date).m, md(o.occasion_date).d))}</p>`)
        .join("");
      const r = await sendEmail(supabase, {
        customer_id: cust.id, template_name: "yearly_summary",
        reminder_type: "yearly_summary",
        dynamic_variables: { ...biz, first_name: firstName(cust.full_name), occasion_list: list },
      });
      if (r.status === "sent") summaries++;
    }
  }

  await notify(supabase, "daily_check",
    `Daily check: ${emails} emails, ${waTasks} WhatsApp tasks, ${dupes} duplicates skipped, ${failures} failures` +
    (yearlyReset ? `, ${yearlyReset} occasions reset, ${summaries} yearly summaries` : ""));
  return json({ status: "ok", emails, waTasks, dupes, failures, yearlyReset, summaries, date: ymd(today.year, today.month, today.day) });
});
