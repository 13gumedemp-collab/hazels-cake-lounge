import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE, verifySession } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseServer";

const TEMPLATE_FOR_REMINDER: Record<string, string> = {
  one_month: "reminder_one_month",
  two_weeks: "reminder_two_weeks",
  one_week: "reminder_one_week",
};

function pretty(value: string | null) {
  if (!value) return "Date to be confirmed";
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function POST(req: NextRequest) {
  if (!(await verifySession(cookies().get(COOKIE)?.value))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const customerId = String(body.customer_id || "");
  const reminderType = String(body.reminder_type || body.template_name || "");
  const templateName = String(body.template_name || TEMPLATE_FOR_REMINDER[reminderType] || reminderType);
  const memberId = body.circle_member_id ? String(body.circle_member_id) : null;
  if (!customerId || !templateName) return NextResponse.json({ error: "Customer and template are required" }, { status: 400 });

  const sb = supabaseAdmin();
  const [{ data: customer }, { data: member }] = await Promise.all([
    sb.from("customers").select("id, full_name, first_name, email, whatsapp_number").eq("id", customerId).maybeSingle(),
    memberId
      ? sb.from("circle_members").select("id, person_name, occasion_type, occasion_date, relationship_to_customer").eq("id", memberId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const variables = {
    first_name: customer.first_name || customer.full_name.split(/\s+/)[0],
    customer_name: customer.full_name,
    customer_email: customer.email,
    customer_phone: customer.whatsapp_number || "",
    person_name: member?.person_name || "your special person",
    occasion_type: member?.occasion_type || "occasion",
    occasion_date: pretty(member?.occasion_date || null),
    relationship: member?.relationship_to_customer || "",
  };
  const { data, error } = await sb.functions.invoke("send-email", {
    body: {
      customer_id: customerId,
      circle_member_id: memberId,
      template_name: templateName,
      reminder_type: reminderType || templateName,
      dynamic_variables: variables,
    },
  });
  if (error) return NextResponse.json({ status: "failed", error: error.message }, { status: 502 });
  return NextResponse.json(data || { status: "sent" });
}
