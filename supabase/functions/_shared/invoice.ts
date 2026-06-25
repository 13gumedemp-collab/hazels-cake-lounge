// Generates a branded PDF invoice / deposit confirmation for an order, stores
// it in the invoices bucket, and emails it to the customer (invoice_delivery).
// Note: the schema has no pricing columns, so amounts are confirmed by Hazel
// separately; this document captures the order details and the deposit receipt.
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { firstName, notify } from "./client.ts";
import { sendEmail } from "./email.ts";

const GOLD = rgb(0.788, 0.659, 0.298);
const INK = rgb(0.12, 0.11, 0.10);

function toBase64(bytes: Uint8Array): string {
  let b = "";
  for (let i = 0; i < bytes.length; i += 0x8000) b += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(b);
}
function prettyDate(d: string | null): string {
  if (!d) return "";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB",
    { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export async function generateInvoice(
  supabase: SupabaseClient,
  order_id: string,
): Promise<{ status: string; error?: string }> {
  const { data: order, error } = await supabase
    .from("orders")
    .select(`id, cake_flavour, cake_description, occasion_date, delivery_or_collection,
             customer:customers ( id, full_name, email ),
             occasion:occasions ( person_name, occasion_type )`)
    .eq("id", order_id)
    .single();
  if (error || !order) return { status: "failed", error: "Order not found" };
  const customer = order.customer as { id: string; full_name: string; email: string } | null;
  const occasion = order.occasion as { person_name: string; occasion_type: string } | null;
  if (!customer) return { status: "failed", error: "Order has no customer" };

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]); // A4
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);

  let y = height - 70;
  page.drawText("Hazel's Cake Lounge", { x: 50, y, size: 22, font: bold, color: INK });
  y -= 22;
  page.drawText("Order Confirmation & Invoice", { x: 50, y, size: 12, font: serif, color: GOLD });
  page.drawLine({ start: { x: 50, y: y - 14 }, end: { x: width - 50, y: y - 14 }, thickness: 1, color: GOLD });
  y -= 48;

  const row = (label: string, value: string) => {
    page.drawText(label, { x: 50, y, size: 11, font: bold, color: INK });
    page.drawText(value || "-", { x: 200, y, size: 11, font: serif, color: INK });
    y -= 22;
  };
  row("Invoice no.", order.id.slice(0, 8).toUpperCase());
  row("Date", prettyDate(new Date().toISOString().slice(0, 10)));
  row("Billed to", customer.full_name);
  row("Email", customer.email);
  row("Occasion", occasion ? `${occasion.person_name}'s ${occasion.occasion_type}` : "-");
  row("Needed for", prettyDate(order.occasion_date));
  row("Cake", order.cake_flavour || "-");
  row("Details", (order.cake_description || "-").slice(0, 60));
  row("Fulfilment", order.delivery_or_collection || "-");

  y -= 16;
  page.drawText("Deposit received with thanks. Final balance confirmed separately.",
    { x: 50, y, size: 11, font: serif, color: GOLD });
  y -= 40;
  page.drawText("Thank you for trusting me with your celebration.",
    { x: 50, y, size: 12, font: serif, color: INK });
  y -= 18;
  page.drawText("Hazel", { x: 50, y, size: 12, font: bold, color: INK });

  const bytes = await pdf.save();
  const path = `${order_id}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("invoices").upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return { status: "failed", error: `Storage: ${upErr.message}` };

  await sendEmail(supabase, {
    customer_id: customer.id,
    template_name: "invoice_delivery",
    reminder_type: "invoice",
    dynamic_variables: {
      first_name: firstName(customer.full_name),
      person_name: occasion?.person_name ?? "",
      occasion_type: occasion?.occasion_type ?? "",
    },
    attachments: [{ filename: "Invoice.pdf", content: toBase64(bytes) }],
  });
  await notify(supabase, "invoice_sent", `Invoice sent to ${customer.full_name}.`);
  return { status: "sent" };
}
