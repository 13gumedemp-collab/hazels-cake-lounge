import SettingsPanel from "@/components/SettingsPanel";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const sb = supabaseAdmin();
  const [{ data: settings }, { data: templates }] = await Promise.all([
    sb.from("app_settings").select("key, value").in("key", ["business", "reminders"]),
    sb.from("message_templates").select("template_name, subject, body").eq("channel", "email").order("template_name"),
  ]);
  const byKey = Object.fromEntries((settings || []).map((row) => [row.key, row.value]));
  const business = {
    business_name: "Hazel's Cake Lounge",
    business_email: "hello@hazelscakelounge.co.za",
    business_phone: process.env.BUSINESS_PHONE || "073 373 4234",
    site_url: process.env.NEXT_PUBLIC_SITE_URL || "https://hazelscakelounge.co.za",
    service_area: "South Africa",
    reply_days: 2,
    ...(byKey.business as object || {}),
  };
  const reminders = {
    email_enabled: true,
    whatsapp_enabled: true,
    phone_enabled: true,
    ...(byKey.reminders as object || {}),
  };

  return (
    <div className="admin-page max-w-7xl mx-auto">
      <div className="page-heading"><p className="eyebrow">Command Centre controls</p><h1>Settings</h1><p className="text-creamSoft mt-2">Business details, reminder channels, message copy, delivery checks and admin security.</p></div>
      <SettingsPanel initialBusiness={business} initialReminders={reminders} initialTemplates={(templates || []).map((template) => ({ template_name: template.template_name || "", subject: template.subject || "", body: template.body || "" }))} />
    </div>
  );
}
