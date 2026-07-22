// daily-occasion-checker  (06:00 UTC / 08:00 SAST via pg_cron)
//
// Recurring circle_members:
//   30/14/7 days before -> reminder emails (+ WhatsApp tasks at 1mo & 1wk)
//   +2 days after        -> post_celebration
// Birthdays -> birthday_surprise. 1 Jan -> reset recurring dates + yearly_summary.
// One-time circle_members -> anniversary notification to Hazel (no customer email).
// Completion sweeps: post_celebration 2 days after an order completes;
//   circle_followup 30 days after a customer's first completed order.
// Dedupe is per circle_member + reminder_type + calendar year (reminder_log.year_sent).
import { adminClient, businessVars, corsHeaders, firstName, json, notify } from "../_shared/client.ts";
import { sendEmail } from "../_shared/email.ts";

const EMAIL_TEMPLATE: Record<string, string> = {
  one_month: "reminder_one_month", two_weeks: "reminder_two_weeks",
  one_week: "reminder_one_week", post_celebration: "post_celebration",
};
const DAY = 86_400_000;

function sastNow() {
  const s = new Date(Date.now() + 2 * 3600 * 1000);
  return { year: s.getUTCFullYear(), month: s.getUTCMonth(), day: s.getUTCDate(), date: new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate())) };
}
function md(s: string) { const [, mm, dd] = s.split("-").map(Number); return { m: mm - 1, d: dd, y: Number(s.split("-")[0]) }; }
function isLeap(y: number) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function ymd(y: number, m: number, d: number) { if (m === 1 && d === 29 && !isLeap(y)) d = 28; return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function pretty(d: string) { return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }); }
function waCopy(type: string, v: Record<string, string>) {
  return type === "one_month"
    ? `Hi ${v.first_name}, it is Hazel from Hazel's Cake Lounge. Just a friendly heads up that ${v.person_name}'s ${v.occasion_type} is coming up in about a month. I would love to bake something special again. Pop me a message whenever you are ready to chat.`
    : `Hi ${v.first_name}, Hazel here. Just one week until ${v.person_name}'s ${v.occasion_type}. My diary is filling up for that week so let me know if you would like to place an order. Here is the link: ${v.enquiry_url}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = adminClient();
  const today = sastNow();
  const biz = businessVars();
  let emails = 0, waTasks = 0, callTasks = 0, failures = 0, dupes = 0, anniversaries = 0, followups = 0, postCeleb = 0;

  const { data: logs } = await supabase
    .from("reminder_log").select("circle_member_id, reminder_type, customer_id, status, year_sent")
    .eq("year_sent", today.year);
  const done = new Set((logs ?? []).filter((l) => l.status === "sent" || l.status === "skipped" || l.status === "manually_sent").map((l) => `${l.circle_member_id ?? "x"}|${l.reminder_type}`));
  const bdayDone = new Set((logs ?? []).filter((l) => l.reminder_type === "birthday_surprise" && l.status === "sent").map((l) => l.customer_id));
  const annDone = new Set((logs ?? []).filter((l) => l.reminder_type === "anniversary_memory").map((l) => l.circle_member_id));

  const { data: waRows } = await supabase.from("whatsapp_reminders_due").select("circle_member_id, reminder_type, created_at").gte("created_at", `${today.year}-01-01`);
  const waDone = new Set((waRows ?? []).map((r) => `${r.circle_member_id}|${r.reminder_type}`));
  const { data: callRows } = await supabase.from("phone_call_reminders_due").select("circle_member_id, reminder_type, due_date").gte("due_date", `${today.year}-01-01`);
  const callDone = new Set((callRows ?? []).map((r) => `${r.circle_member_id}|${r.reminder_type}`));

  const { data: members } = await supabase
    .from("circle_members")
    .select(`id, person_name, occasion_type, occasion_date, recurring_yearly, is_one_time, customer_id,
             customer:customers ( id, full_name, email_consent, whatsapp_consent, phone_call_consent, whatsapp_number )`);

  const flavourFor = async (memberId: string): Promise<string | null> => {
    const { data } = await supabase.from("orders").select("cake_flavour").eq("circle_member_id", memberId).not("cake_flavour", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return data?.cake_flavour ?? null;
  };

  for (const m of members ?? []) {
    const c = m.customer as { id: string; full_name: string; email_consent: boolean; whatsapp_consent: boolean; phone_call_consent: boolean; whatsapp_number: string | null } | null;
    if (!c) continue;
    const { m: mm, d: dd, y: occY } = md(m.occasion_date);

    // One-time: anniversary notification to Hazel in subsequent years.
    if (m.is_one_time) {
      if (mm === today.month && dd === today.day && today.year > occY && !annDone.has(m.id)) {
        await notify(supabase, "anniversary_memory",
          `Today is the anniversary of ${c.full_name}'s ${m.occasion_type} for ${m.person_name}. It has been ${today.year - occY} year(s).`, "standard", "/occasions");
        await supabase.from("reminder_log").insert({ customer_id: c.id, circle_member_id: m.id, reminder_type: "anniversary_memory", channel: "internal", status: "sent", year_sent: today.year });
        anniversaries++;
      }
      continue;
    }
    if (!m.recurring_yearly) continue;

    const thisYear = new Date(Date.UTC(today.year, mm, dd));
    const next = thisYear.getTime() >= today.date.getTime() ? thisYear : new Date(Date.UTC(today.year + 1, mm, dd));
    const last = thisYear.getTime() <= today.date.getTime() ? thisYear : new Date(Date.UTC(today.year - 1, mm, dd));
    const daysUntil = Math.round((next.getTime() - today.date.getTime()) / DAY);
    const daysSince = Math.round((today.date.getTime() - last.getTime()) / DAY);

    let type: string | null = null;
    if (daysUntil === 30) type = "one_month";
    else if (daysUntil === 14) type = "two_weeks";
    else if (daysUntil === 7) type = "one_week";
    else if (daysSince === 2) type = "post_celebration";
    if (!type) continue;

    const flavour = await flavourFor(m.id);
    const vars: Record<string, string> = {
      ...biz, first_name: firstName(c.full_name), person_name: m.person_name,
      occasion_type: m.occasion_type, occasion_date: pretty(m.occasion_date),
      occasion_book_opted_in: "yes",
      previous_order: flavour ? "yes" : "", previous_flavour: flavour ?? "",
    };

    if (done.has(`${m.id}|${type}`)) {
      await supabase.from("reminder_log").insert({ customer_id: c.id, circle_member_id: m.id, reminder_type: type, channel: "email", status: "duplicate_skipped", year_sent: today.year });
      dupes++;
    } else if (c.email_consent !== false) {
      const r = await sendEmail(supabase, { customer_id: c.id, template_name: EMAIL_TEMPLATE[type], reminder_type: type, circle_member_id: m.id, dynamic_variables: vars });
      if (r.status === "sent") emails++; else if (r.status === "failed") failures++;
      done.add(`${m.id}|${type}`);
    }

    if ((type === "one_month" || type === "one_week") && c.whatsapp_consent && c.whatsapp_number && !waDone.has(`${m.id}|${type}`)) {
      await supabase.from("whatsapp_reminders_due").insert({ customer_id: c.id, circle_member_id: m.id, reminder_type: type, whatsapp_number: c.whatsapp_number, message_copy: waCopy(type, vars), due_date: next.toISOString().slice(0, 10), status: "pending" });
      await notify(supabase, "whatsapp_due", `WhatsApp ${type.replace("_", " ")} reminder due for ${c.full_name} (${m.person_name}'s ${m.occasion_type})`, "standard", "/whatsapp");
      waTasks++; waDone.add(`${m.id}|${type}`);
    }
    if (c.phone_call_consent && c.whatsapp_number && !callDone.has(`${m.id}|${type}`)) {
      await supabase.from("phone_call_reminders_due").insert({
        customer_id: c.id, circle_member_id: m.id, reminder_type: type,
        phone_number: c.whatsapp_number, due_date: today.date.toISOString().slice(0, 10), status: "pending",
      });
      await notify(supabase, "phone_call_due", `Call ${c.full_name} about ${m.person_name}'s ${m.occasion_type}.`, "standard", "/calls");
      callTasks++; callDone.add(`${m.id}|${type}`);
    }
  }

  // Birthdays
  const { data: bdays } = await supabase.from("customers").select("id, full_name, email_consent, own_birthday").not("own_birthday", "is", null);
  for (const c of bdays ?? []) {
    const { m: bm, d: bd } = md(c.own_birthday as string);
    if (bm !== today.month || bd !== today.day || bdayDone.has(c.id) || c.email_consent === false) continue;
    const r = await sendEmail(supabase, { customer_id: c.id, template_name: "birthday_surprise", reminder_type: "birthday_surprise", dynamic_variables: { ...biz, first_name: firstName(c.full_name) } });
    if (r.status === "sent") emails++; else if (r.status === "failed") failures++;
  }

  // Post-celebration 2 days after an order completes (covers one-time orders too)
  const twoDaysAgo = new Date(today.date.getTime() - 2 * DAY).toISOString().slice(0, 10);
  const { data: completed } = await supabase
    .from("orders")
    .select(`id, circle_member_id, completed_at, customer:customers ( id, full_name, email_consent ), circle_member:circle_members ( person_name, occasion_type, recurring_yearly )`)
    .eq("status", "completed").not("completed_at", "is", null)
    .gte("completed_at", `${twoDaysAgo}T00:00:00`).lte("completed_at", `${twoDaysAgo}T23:59:59`);
  for (const o of completed ?? []) {
    const c = o.customer as { id: string; full_name: string; email_consent: boolean } | null;
    const cm = o.circle_member as { person_name: string; occasion_type: string; recurring_yearly: boolean } | null;
    if (!c || !o.circle_member_id || done.has(`${o.circle_member_id}|post_celebration`) || c.email_consent === false) continue;
    const r = await sendEmail(supabase, {
      customer_id: c.id, template_name: "post_celebration", reminder_type: "post_celebration", circle_member_id: o.circle_member_id,
      dynamic_variables: { ...biz, first_name: firstName(c.full_name), person_name: cm?.person_name ?? "", occasion_type: cm?.occasion_type ?? "", occasion_book_opted_in: cm?.recurring_yearly ? "yes" : "" },
    });
    if (r.status === "sent") { postCeleb++; done.add(`${o.circle_member_id}|post_celebration`); }
  }

  // Circle follow-up 30 days after first completed order
  const thirtyAgo = new Date(today.date.getTime() - 30 * DAY).toISOString();
  const { data: followupCustomers } = await supabase
    .from("customers").select("id, full_name").eq("circle_followup_sent", false).not("first_order_completed_at", "is", null).lte("first_order_completed_at", thirtyAgo);
  for (const cust of followupCustomers ?? []) {
    const { data: ord } = await supabase.from("orders").select("circle_member:circle_members ( person_name, occasion_type )").eq("customer_id", cust.id).eq("status", "completed").order("created_at", { ascending: false }).limit(1).maybeSingle();
    const cm = ord?.circle_member as { person_name: string; occasion_type: string } | null;
    const r = await sendEmail(supabase, { customer_id: cust.id, template_name: "circle_followup", reminder_type: "circle_followup", dynamic_variables: { ...biz, first_name: firstName(cust.full_name), person_name: cm?.person_name ?? "them", occasion_type: cm?.occasion_type ?? "celebration" } });
    await supabase.from("customers").update({ circle_followup_sent: true }).eq("id", cust.id);
    if (r.status === "sent") followups++;
  }

  // 1 January: reset recurring dates + yearly summary
  let reset = 0, summaries = 0;
  if (today.month === 0 && today.day === 1) {
    for (const m of (members ?? []).filter((x) => x.recurring_yearly)) {
      const { m: mm, d: dd } = md(m.occasion_date);
      await supabase.from("circle_members").update({ occasion_date: ymd(today.year, mm, dd) }).eq("id", m.id);
      reset++;
    }
    const summaryDone = new Set((logs ?? []).filter((l) => l.reminder_type === "yearly_summary" && l.status === "sent").map((l) => l.customer_id));
    const { data: customers } = await supabase.from("customers").select(`id, full_name, email_consent, circle_members ( person_name, occasion_type, occasion_date, recurring_yearly )`);
    for (const cust of customers ?? []) {
      if (cust.email_consent === false || summaryDone.has(cust.id)) continue;
      const cms = ((cust.circle_members as { person_name: string; occasion_type: string; occasion_date: string; recurring_yearly: boolean }[] | null) ?? []).filter((x) => x.recurring_yearly).sort((a, b) => a.occasion_date.localeCompare(b.occasion_date));
      if (!cms.length) continue;
      const list = cms.map((o) => `<p style="margin:4px 0"><b>${o.person_name}'s ${o.occasion_type}</b> on ${pretty(ymd(today.year, md(o.occasion_date).m, md(o.occasion_date).d))}</p>`).join("");
      const r = await sendEmail(supabase, { customer_id: cust.id, template_name: "yearly_summary", reminder_type: "yearly_summary", dynamic_variables: { ...biz, first_name: firstName(cust.full_name), occasion_list: list } });
      if (r.status === "sent") summaries++;
    }
  }

  await notify(supabase, "daily_check", `Daily check: ${emails} emails, ${waTasks} WhatsApp tasks, ${callTasks} call tasks, ${postCeleb} post-celebration, ${anniversaries} anniversaries, ${followups} circle follow-ups, ${dupes} dupes, ${failures} failures${reset ? `, ${reset} reset, ${summaries} summaries` : ""}`);
  return json({ status: "ok", emails, waTasks, callTasks, postCeleb, anniversaries, followups, dupes, failures, reset, summaries });
});
