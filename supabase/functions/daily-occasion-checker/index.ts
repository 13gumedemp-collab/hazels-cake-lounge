// daily-occasion-checker  (run by pg_cron at 08:00 SAST)
// Walks every recurring occasion, works out how far away the next occurrence is,
// and triggers reminders:
//   30 days  -> one_month
//   14 days  -> two_weeks
//    7 days  -> one_week
//   +2 days  -> post_celebration (two days AFTER the date)
// Birthdays (customers.own_birthday == today) -> birthday_surprise.
//
// Email reminders send automatically via Resend. WhatsApp reminders are NOT
// auto-sent (Hazel sends those by hand in the WhatsApp Business app) — instead
// we log a 'manual_pending' entry and raise a notification so it appears as a
// task in the admin dashboard. Dedupe is per occasion + reminder_type + year.
import { adminClient, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail } from "../_shared/email.ts";

const SITE_URL = Deno.env.get("SITE_URL") ?? "https://hazelscakelounge.co.za";
const ENQUIRY_LINK = `${SITE_URL}/contact.html`;

// reminder_type -> email template
const EMAIL_TEMPLATE: Record<string, string> = {
  one_month: "reminder_one_month",
  two_weeks: "reminder_two_weeks",
  one_week: "reminder_one_week",
  post_celebration: "post_celebration",
  birthday_surprise: "birthday_surprise",
};
// reminder_type -> whatsapp template (only those that exist)
const WHATSAPP_TEMPLATE: Record<string, string> = {
  one_month: "whatsapp_one_month",
  one_week: "whatsapp_one_week",
  post_celebration: "whatsapp_post_celebration",
};

const DAY = 86_400_000;

// Today's date components in SAST (UTC+2), as a UTC-midnight Date for math.
function sastToday(): { date: Date; year: number; month: number; day: number } {
  const now = new Date();
  const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const year = sast.getUTCFullYear(), month = sast.getUTCMonth(), day = sast.getUTCDate();
  return { date: new Date(Date.UTC(year, month, day)), year, month, day };
}

function parseDate(d: string): { m: number; day: number } {
  const [, mm, dd] = d.split("-").map(Number) as unknown as number[];
  return { m: mm - 1, day: dd };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = adminClient();
  const today = sastToday();
  let processed = 0, emailsSent = 0, manualTasks = 0, failures = 0;

  // Already-handled (occasion_id|type) for the current year, to dedupe.
  const { data: logs } = await supabase
    .from("reminder_log")
    .select("occasion_id, reminder_type, customer_id, sent_at, status")
    .gte("sent_at", `${today.year}-01-01`);
  const handled = new Set(
    (logs ?? [])
      .filter((l) => l.status !== "failed")
      .map((l) => `${l.occasion_id ?? "x"}|${l.reminder_type}`),
  );
  const birthdayHandled = new Set(
    (logs ?? [])
      .filter((l) => l.reminder_type === "birthday_surprise" && l.status !== "failed")
      .map((l) => l.customer_id),
  );

  // ---- Occasion reminders -------------------------------------------------
  const { data: occasions } = await supabase
    .from("occasions")
    .select(`id, person_name, occasion_type, occasion_date, customer_id,
             customer:customers ( id, full_name, email, email_consent,
                                  whatsapp_consent, whatsapp_number )`)
    .eq("recurring_yearly", true);

  for (const occ of occasions ?? []) {
    const c = occ.customer as {
      id: string; full_name: string; email_consent: boolean;
      whatsapp_consent: boolean; whatsapp_number: string | null;
    } | null;
    if (!c) continue;

    const { m, day } = parseDate(occ.occasion_date);
    const thisYear = new Date(Date.UTC(today.year, m, day));
    const next = thisYear.getTime() >= today.date.getTime()
      ? thisYear
      : new Date(Date.UTC(today.year + 1, m, day));
    const last = thisYear.getTime() <= today.date.getTime()
      ? thisYear
      : new Date(Date.UTC(today.year - 1, m, day));

    const daysUntil = Math.round((next.getTime() - today.date.getTime()) / DAY);
    const daysSince = Math.round((today.date.getTime() - last.getTime()) / DAY);

    let reminderType: string | null = null;
    if (daysUntil === 30) reminderType = "one_month";
    else if (daysUntil === 14) reminderType = "two_weeks";
    else if (daysUntil === 7) reminderType = "one_week";
    else if (daysSince === 2) reminderType = "post_celebration";
    if (!reminderType) continue;
    if (handled.has(`${occ.id}|${reminderType}`)) continue;

    processed++;
    const vars = {
      first_name: firstName(c.full_name),
      person_name: occ.person_name,
      occasion_type: occ.occasion_type,
      occasion_date: occ.occasion_date,
      enquiry_link: ENQUIRY_LINK,
    };

    // Email (auto)
    if (c.email_consent !== false) {
      const r = await sendEmail(supabase, {
        customer_id: c.id,
        template_name: EMAIL_TEMPLATE[reminderType],
        reminder_type: reminderType,
        occasion_id: occ.id,
        dynamic_variables: vars,
      });
      if (r.status === "sent") emailsSent++;
      else if (r.status === "failed") failures++;
    }

    // WhatsApp (manual task for Hazel)
    if (c.whatsapp_consent && WHATSAPP_TEMPLATE[reminderType] && c.whatsapp_number) {
      await supabase.from("reminder_log").insert({
        customer_id: c.id, occasion_id: occ.id, reminder_type: reminderType,
        channel: "whatsapp", status: "manual_pending",
      });
      await notify(supabase, "whatsapp_manual_due",
        `WhatsApp ${reminderType.replace("_", " ")} reminder due for ${c.full_name} (${occ.person_name}'s ${occ.occasion_type}) — send manually`);
      manualTasks++;
    }
  }

  // ---- Birthdays ----------------------------------------------------------
  const { data: birthdayCustomers } = await supabase
    .from("customers")
    .select("id, full_name, email_consent, own_birthday")
    .not("own_birthday", "is", null);

  for (const c of birthdayCustomers ?? []) {
    const { m, day } = parseDate(c.own_birthday as string);
    if (m !== today.month || day !== today.day) continue;
    if (birthdayHandled.has(c.id)) continue;
    if (c.email_consent === false) continue;
    processed++;
    const r = await sendEmail(supabase, {
      customer_id: c.id,
      template_name: EMAIL_TEMPLATE.birthday_surprise,
      reminder_type: "birthday_surprise",
      dynamic_variables: { first_name: firstName(c.full_name) },
    });
    if (r.status === "sent") emailsSent++;
    else if (r.status === "failed") failures++;
  }

  const summary = { processed, emailsSent, manualTasks, failures, date: today.date.toISOString().slice(0, 10) };
  await notify(supabase, "daily_check",
    `Daily occasion check: ${emailsSent} emails, ${manualTasks} WhatsApp tasks, ${failures} failures`);
  return json({ status: "ok", ...summary });
});
