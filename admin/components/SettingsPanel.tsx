"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

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

function previewHtml(body: string, subject: string | undefined) {
  let html = body || "";
  html = html.replace(/\{\{#if\s+([\w]+)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, inner) => DEMO[key] ? inner : "");
  void subject;
  return html.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_match, key) => DEMO[key] || "");
}

/* ----- Writing an email without writing HTML -----
   The stored body is HTML because that is what Resend sends. Hazel should not
   have to type tags to change a sentence, so plain mode shows the words only
   and rebuilds the HTML on save, keeping whatever wrapper the template already
   carries so the email keeps its typography. Template variables are left alone:
   they are braces, not markup, so they survive both directions untouched. */
const PLAIN_SAFE = /^(div|p|br|strong|b|em|i|span)$/i;

function isSimpleBody(html: string) {
  const tags = [...(html || "").matchAll(/<\s*\/?\s*([a-zA-Z0-9]+)/g)].map((match) => match[1]);
  return tags.every((tag) => PLAIN_SAFE.test(tag));
}

function htmlToPlain(html: string) {
  return (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainToHtml(text: string, previous: string) {
  const escape = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const paragraphs = (text || "")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const wrapper = (previous || "").match(/^\s*<div[^>]*>/i);
  const open = wrapper ? wrapper[0].trim() : '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.7;color:#2a2722;max-width:560px">';
  return `${open}${paragraphs}</div>`;
}

export default function SettingsPanel({ initialBusiness, initialReminders, initialTemplates }: {
  initialBusiness: BusinessSettings;
  initialReminders: ReminderSettings;
  initialTemplates: Template[];
}) {
  const [business, setBusiness] = useState(initialBusiness);
  const [savedBusiness, setSavedBusiness] = useState(initialBusiness);
  const [reminders, setReminders] = useState(initialReminders);
  const [templates, setTemplates] = useState(initialTemplates);
  const [savedTemplates, setSavedTemplates] = useState(initialTemplates);
  const [selectedName, setSelectedName] = useState(initialTemplates[0]?.template_name || "");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  // Nothing on this page is editable until it is asked for. Both forms hold
  // details that are expensive to change by accident: the address customers
  // reply to, and the words of every reminder that goes out.
  const [editingBusiness, setEditingBusiness] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(false);
  const [mode, setMode] = useState<"plain" | "html">("plain");
  const [plainDraft, setPlainDraft] = useState("");

  const selected = templates.find((template) => template.template_name === selectedName);

  // Switching template out of edit mode reloads the plain draft from the stored
  // body, so the box always opens on what is actually saved.
  useEffect(() => {
    const body = templates.find((template) => template.template_name === selectedName)?.body || "";
    setPlainDraft(htmlToPlain(body));
    setMode(isSimpleBody(body) ? "plain" : "html");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedName]);

  const bodyForSave = mode === "plain" && editingTemplate ? plainToHtml(plainDraft, selected?.body || "") : (selected?.body || "");
  const preview = useMemo(() => previewHtml(bodyForSave, selected?.subject), [bodyForSave, selected?.subject]);

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

  async function saveBusiness(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBusiness) return;
    const ok = await save("business", { value: business });
    if (ok) { setSavedBusiness(business); setEditingBusiness(false); }
  }

  function cancelBusiness() {
    setBusiness(savedBusiness);
    setEditingBusiness(false);
    setNotice("");
  }

  async function saveTemplate() {
    if (!selected) return;
    const next = { ...selected, body: bodyForSave };
    const ok = await save("template", { value: next });
    if (ok) {
      const updated = templates.map((template) => template.template_name === selectedName ? next : template);
      setTemplates(updated);
      setSavedTemplates(updated);
      setPlainDraft(htmlToPlain(next.body));
      setEditingTemplate(false);
    }
  }

  function cancelTemplate() {
    setTemplates(savedTemplates);
    const body = savedTemplates.find((template) => template.template_name === selectedName)?.body || "";
    setPlainDraft(htmlToPlain(body));
    setEditingTemplate(false);
    setNotice("");
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
        <div className="settings-section__intro"><p className="eyebrow">Appearance</p><h2>Workspace theme</h2><p>Soft ivory by day, or the same black and gold the customer site wears. The choice is kept on this device.</p></div>
        <ThemeToggle />
      </section>

      <section className="surface-card settings-section">
        <div className="settings-section__intro"><p className="eyebrow">Business</p><h2>Business details</h2><p>Reference details for the Command Centre and customer facing content. Delivery credentials remain protected in Supabase.</p></div>
        <form onSubmit={saveBusiness} className={`settings-form settings-form--business ${editingBusiness ? "" : "settings-form--locked"}`} method="post">
          {([
            ["business_name", "Business name", "text"], ["business_email", "Public email", "email"], ["business_phone", "Phone", "tel"],
            ["site_url", "Website", "url"], ["service_area", "Service area", "text"], ["reply_days", "Reply within days", "number"],
          ] as [keyof BusinessSettings, string, string][]).map(([key, label, type]) => (
            <label key={key}><span>{label}</span><input type={type} min={type === "number" ? 1 : undefined} readOnly={!editingBusiness} value={String(business[key])} onChange={(event) => setBusiness({ ...business, [key]: type === "number" ? Number(event.target.value) : event.target.value })} /></label>
          ))}
          {editingBusiness ? (
            <div className="settings-lock">
              <button type="submit" disabled={busy === "business"}>{busy === "business" ? "Saving..." : "Save business details"}</button>
              <button type="button" className="settings-cancel" onClick={cancelBusiness}>Cancel</button>
            </div>
          ) : (
            <div className="settings-lock">
              <button type="button" className="settings-edit" onClick={() => { setEditingBusiness(true); setNotice(""); }}>Edit business details</button>
              <span className="settings-lock__note">Locked, so the public email and phone number cannot be changed by a stray keystroke.</span>
            </div>
          )}
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
        <div className="settings-section__intro"><p className="eyebrow">Copy</p><h2>Message templates</h2><p>Write the email in plain words and the preview beside it updates as you type. Anything in double braces is filled in per customer, so leave those as they are.</p></div>
        <div className={`template-editor ${editingTemplate ? "" : "template-editor--locked"}`}>
          <label><span>Template</span><select value={selectedName} disabled={editingTemplate} onChange={(event) => setSelectedName(event.target.value)}>{templates.map((template) => <option value={template.template_name} key={template.template_name}>{template.template_name.replaceAll("_", " ")}</option>)}</select></label>
          <label><span>Subject</span><input value={selected?.subject || ""} readOnly={!editingTemplate} onChange={(event) => updateTemplate("subject", event.target.value)} /></label>
          <label>
            <span className="template-editor__label">
              Email body
              {editingTemplate && (
                <span className="template-mode">
                  <button type="button" className={mode === "plain" ? "is-active" : ""} onClick={() => setMode("plain")}>Plain words</button>
                  <button type="button" className={mode === "html" ? "is-active" : ""} onClick={() => setMode("html")}>HTML</button>
                </span>
              )}
            </span>
            {mode === "plain" && editingTemplate ? (
              <textarea rows={14} className="is-plain" value={plainDraft} onChange={(event) => setPlainDraft(event.target.value)} />
            ) : (
              <textarea rows={14} readOnly={!editingTemplate} value={mode === "plain" && !editingTemplate ? plainDraft : (selected?.body || "")} className={mode === "plain" ? "is-plain" : ""} onChange={(event) => updateTemplate("body", event.target.value)} />
            )}
          </label>
          {editingTemplate ? (
            <div className="settings-lock">
              <button type="button" disabled={!selected || busy === "template"} onClick={saveTemplate}>{busy === "template" ? "Saving..." : "Save template"}</button>
              <button type="button" className="settings-cancel" onClick={cancelTemplate}>Cancel</button>
              {mode === "plain" && <span className="settings-lock__note">Saving rewrites the body as tidy paragraphs. Switch to HTML if this email needs its own markup.</span>}
            </div>
          ) : (
            <div className="settings-lock">
              <button type="button" className="settings-edit" onClick={() => { setEditingTemplate(true); setNotice(""); }}>Edit this email</button>
              <span className="settings-lock__note">Locked until you choose to edit, so no customer email changes by accident.</span>
            </div>
          )}
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
