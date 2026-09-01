"use client";

import { FormEvent, useMemo, useState } from "react";

interface BusinessSettings {
  business_name: string;
  business_email: string;
  business_phone: string;
  site_url: string;
  service_area: string;
  reply_days: number;
}

interface ReminderSettings {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  phone_enabled: boolean;
}

interface Template { template_name: string; subject: string; body: string }

const DEMO: Record<string, string> = {
  first_name: "Nomsa", customer_name: "Nomsa Dlamini", customer_email: "nomsa@example.com",
  customer_phone: "073 000 0000", person_name: "Lerato", occasion_type: "Birthday",
  occasion_date: "18 October 2026", business_name: "Hazel's Cake Lounge",
  business_phone: "073 373 4234", business_email: "hello@hazelscakelounge.co.za",
  enquiry_url: "https://hazelscakelounge.co.za/contact.html", admin_dashboard_url: "https://admin.hazelscakelounge.co.za",
  sent_at: "31 August 2026 at 14:00",
};

function previewHtml(template: Template | undefined) {
  if (!template) return "";
  let html = template.body || "";
  html = html.replace(/\{\{#if\s+([\w]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, inner) => DEMO[key] ? inner : "");
  return html.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key) => DEMO[key] || "");
}

export default function SettingsPanel({ initialBusiness, initialReminders, initialTemplates }: {
  initialBusiness: BusinessSettings;
  initialReminders: ReminderSettings;
  initialTemplates: Template[];
}) {
  const [business, setBusiness] = useState(initialBusiness);
  const [reminders, setReminders] = useState(initialReminders);
  const [templates, setTemplates] = useState(initialTemplates);
  const [selectedName, setSelectedName] = useState(initialTemplates[0]?.template_name || "");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const selected = templates.find((template) => template.template_name === selectedName);
  const preview = useMemo(() => previewHtml(selected), [selected]);

  async function save(action: string, payload: Record<string, unknown>) {
    setBusy(action); setNotice("");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy("");
    setNotice(response.ok ? result.message || "Saved." : result.error || "That could not be saved.");
    return response.ok;
  }

  function updateTemplate(field: "subject" | "body", value: string) {
    setTemplates((current) => current.map((template) => template.template_name === selectedName ? { ...template, [field]: value } : template));
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = String(form.get("new_password") || "");
    if (next.length < 12) { setNotice("Use at least 12 characters for the admin password."); return; }
    if (next !== String(form.get("confirm_password") || "")) { setNotice("The new passwords do not match."); return; }
    const ok = await save("password", { current_password: form.get("current_password"), new_password: next });
    if (ok) event.currentTarget.reset();
  }

  return (
    <div className="settings-stack mt-6">
      {notice && <p className="message-notice settings-notice" role="status">{notice}</p>}

      <section className="surface-card settings-section">
        <div className="settings-section__intro"><p className="eyebrow">Business</p><h2>Business details</h2><p>Reference details for the Command Centre and customer facing content. Delivery credentials remain protected in Supabase.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); save("business", { value: business }); }} className="settings-form settings-form--business" method="post">
          {([
            ["business_name", "Business name", "text"], ["business_email", "Public email", "email"], ["business_phone", "Phone", "tel"],
            ["site_url", "Website", "url"], ["service_area", "Service area", "text"], ["reply_days", "Reply within days", "number"],
          ] as [keyof BusinessSettings, string, string][]).map(([key, label, type]) => (
            <label key={key}><span>{label}</span><input type={type} min={type === "number" ? 1 : undefined} value={String(business[key])} onChange={(event) => setBusiness({ ...business, [key]: type === "number" ? Number(event.target.value) : event.target.value })} /></label>
          ))}
          <button type="submit" disabled={busy === "business"}>{busy === "business" ? "Saving..." : "Save business details"}</button>
        </form>
      </section>

      <section className="surface-card settings-section">
        <div className="settings-section__intro"><p className="eyebrow">Automation</p><h2>Reminder channels</h2><p>Pause a channel without removing any customer consent. Existing tasks and delivery history stay intact.</p></div>
        <form onSubmit={(event) => { event.preventDefault(); save("reminders", { value: reminders }); }} className="settings-toggles" method="post">
          {([
            ["email_enabled", "Customer reminder emails", "The one month, two week and one week email sequence."],
            ["whatsapp_enabled", "WhatsApp task creation", "Prepared manual messages for customers who consented."],
            ["phone_enabled", "Phone call task creation", "Operational call tasks for dates Hazel is remembering."],
          ] as [keyof ReminderSettings, string, string][]).map(([key, label, note]) => (
            <label key={key}><span><strong>{label}</strong><small>{note}</small></span><input type="checkbox" checked={reminders[key]} onChange={(event) => setReminders({ ...reminders, [key]: event.target.checked })} /></label>
          ))}
          <button type="submit" disabled={busy === "reminders"}>{busy === "reminders" ? "Saving..." : "Save reminder settings"}</button>
        </form>
      </section>

      <section className="surface-card settings-section settings-section--templates">
        <div className="settings-section__intro"><p className="eyebrow">Copy</p><h2>Message templates</h2><p>Edit the subject and email body with a live sample. Template variables remain in double braces.</p></div>
        <div className="template-editor">
          <label><span>Template</span><select value={selectedName} onChange={(event) => setSelectedName(event.target.value)}>{templates.map((template) => <option value={template.template_name} key={template.template_name}>{template.template_name.replaceAll("_", " ")}</option>)}</select></label>
          <label><span>Subject</span><input value={selected?.subject || ""} onChange={(event) => updateTemplate("subject", event.target.value)} /></label>
          <label><span>Email body</span><textarea rows={14} value={selected?.body || ""} onChange={(event) => updateTemplate("body", event.target.value)} /></label>
          <button type="button" disabled={!selected || busy === "template"} onClick={() => selected && save("template", { value: selected })}>{busy === "template" ? "Saving..." : "Save template"}</button>
        </div>
        <div className="template-preview"><p className="eyebrow">Live preview</p><h3>{(selected?.subject || "").replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key) => DEMO[key] || "")}</h3><iframe title="Email template preview" sandbox="" srcDoc={preview} /></div>
      </section>

      <section className="surface-card settings-section">
        <div className="settings-section__intro"><p className="eyebrow">Security</p><h2>Admin password</h2><p>The replacement is stored as a salted hash. Existing signed in sessions remain active until they expire.</p></div>
        <form className="settings-form settings-form--password" onSubmit={changePassword} method="post">
          <label><span>Current password</span><input type="password" name="current_password" autoComplete="current-password" required /></label>
          <label><span>New password</span><input type="password" name="new_password" autoComplete="new-password" minLength={12} required /></label>
          <label><span>Confirm new password</span><input type="password" name="confirm_password" autoComplete="new-password" minLength={12} required /></label>
          <button type="submit" disabled={busy === "password"}>{busy === "password" ? "Saving..." : "Change admin password"}</button>
        </form>
      </section>

      <section className="surface-card settings-section">
        <div className="settings-section__intro"><p className="eyebrow">Delivery check</p><h2>Send a test email</h2><p>Sends a dedicated test message to Hazel&apos;s protected business inbox through the configured sender.</p></div>
        <div className="settings-test"><button type="button" disabled={busy === "test_email"} onClick={() => save("test_email", {})}>{busy === "test_email" ? "Sending..." : "Send test email"}</button></div>
      </section>
    </div>
  );
}
