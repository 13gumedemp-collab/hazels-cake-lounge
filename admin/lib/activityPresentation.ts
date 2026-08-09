export interface ActivityNote {
  type: string;
  message: string;
  priority: string;
  action_url?: string | null;
}

export type ActivityTab = "urgent" | "not_urgent" | "fyi" | "all";

const labels: Record<string, string> = {
  account_created: "New account",
  customer_login: "Customer login",
  account_deleted: "Account closed",
  new_enquiry: "New enquiry",
  callback_requested: "Callback request",
  enquiry_overdue_reply: "Reply needed",
  order_overdue: "Order overdue",
  whatsapp_due: "WhatsApp task",
  phone_call_due: "Call task",
  reminder_failed: "Email delivery issue",
  account_alert_failed: "Account alert issue",
  reminder_sent: "Email sent",
  reminder_skipped: "Email skipped",
  invoice_sent: "Invoice sent",
  memory_card_sent: "Memory card sent",
  circle_member_added: "Circle updated",
  anniversary_memory: "Anniversary reminder",
  order_status_changed: "Order updated",
  daily_check: "Daily activity",
};

export function activityLabel(type: string): string {
  return labels[type] || "Activity";
}

export function activityTab(note: ActivityNote): Exclude<ActivityTab, "all"> {
  if (note.priority === "high") return "urgent";
  if (["whatsapp_due", "phone_call_due"].includes(note.type)) return "not_urgent";
  return "fyi";
}

// Provider responses often contain raw JSON. Keep that detail in the private
// reminder log, but make the activity feed readable and useful at a glance.
export function activityMessage(note: ActivityNote): string {
  const message = String(note.message || "").replace(/\s+/g, " ").trim();
  if (note.type === "daily_check") {
    const nonZero = message
      .replace(/^Daily check:\s*/i, "")
      .replace(/\.$/, "")
      .split(",")
      .map((part) => part.trim())
      .filter((part) => !/^0\b/.test(part));
    return nonZero.length ? `Daily check: ${nonZero.join(", ")}.` : "Daily check completed with nothing requiring attention.";
  }
  if (note.type === "reminder_failed" || note.type === "account_alert_failed") {
    const match = message.match(/Email '([^']+)' to (.+?) FAILED:/i);
    const accountMatch = message.match(/New-account email alert failed for (.+?):/i);
    const recipient = match?.[2] || accountMatch?.[1] || "the customer";
    const emailKind = match?.[1]?.replaceAll("_", " ") || "account alert";
    const reason = /401|api key is invalid/i.test(message)
      ? "Resend rejected the request. Check the email delivery key."
      : "Check the email delivery settings.";
    return `Could not send the ${emailKind} email to ${recipient}. ${reason}`;
  }
  return message;
}
