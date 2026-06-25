// Generates a branded PDF "Cake Memory Card" for a completed order, stores it
// in the memory-cards bucket, and emails it to the customer as an attachment.
// Pure pdf-lib (no headless browser needed in the edge runtime).
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { firstName, notify } from "./client.ts";
import { sendEmail } from "./email.ts";

const GOLD = rgb(0.788, 0.659, 0.298);   // #C9A84C
const CREAM = rgb(0.961, 0.941, 0.910);  // #F5F0E8
const INK = rgb(0.039, 0.039, 0.039);    // #0a0a0a

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function prettyDate(d: string | null): string {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00Z");
  return dt.toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
}

export async function generateMemoryCard(
  supabase: SupabaseClient,
  order_id: string,
): Promise<{ status: string; url?: string; error?: string }> {
  // Fetch order + customer + occasion
  const { data: order, error } = await supabase
    .from("orders")
    .select(`id, cake_flavour, cake_description, cake_photo_url, occasion_date,
             customer:customers ( id, full_name, email ),
             occasion:occasions ( person_name, occasion_type )`)
    .eq("id", order_id)
    .single();
  if (error || !order) return { status: "failed", error: "Order not found" };

  const customer = order.customer as { id: string; full_name: string; email: string } | null;
  const occasion = order.occasion as { person_name: string; occasion_type: string } | null;
  if (!customer) return { status: "failed", error: "Order has no customer" };

  // Build PDF
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([420, 595]); // A5 portrait, points
  const { width, height } = page.getSize();
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  page.drawRectangle({ x: 0, y: 0, width, height, color: INK });
  page.drawRectangle({
    x: 16, y: 16, width: width - 32, height: height - 32,
    borderColor: GOLD, borderWidth: 1,
  });

  // Cake photo (top), if available
  let imgBottom = height - 60;
  if (order.cake_photo_url) {
    try {
      const bytes = await loadPhoto(supabase, order.cake_photo_url);
      if (bytes) {
        let img;
        try { img = await pdf.embedJpg(bytes); }
        catch { img = await pdf.embedPng(bytes); }
        const maxW = width - 80, maxH = 230;
        const scale = Math.min(maxW / img.width, maxH / img.height);
        const w = img.width * scale, h = img.height * scale;
        page.drawImage(img, { x: (width - w) / 2, y: height - 56 - h, width: w, height: h });
        imgBottom = height - 56 - h;
      }
    } catch { /* skip image on failure, keep text card */ }
  }

  const center = (text: string, font: typeof serif, size: number, y: number, color = CREAM) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - w) / 2, y, size, font, color });
  };

  let y = imgBottom - 34;
  center("A Cake Memory", serifItalic, 13, y, GOLD); y -= 30;
  center(occasion?.occasion_type ?? "Celebration", serif, 22, y, CREAM); y -= 22;
  if (occasion?.person_name) { center(`for ${occasion.person_name}`, serifItalic, 13, y, CREAM); y -= 26; }
  else y -= 6;
  if (order.cake_flavour) { center(order.cake_flavour, serif, 13, y, GOLD); y -= 20; }
  if (order.occasion_date) { center(prettyDate(order.occasion_date), serif, 11, y, CREAM); y -= 30; }
  center(`Made for ${customer.full_name}`, serif, 11, y, CREAM); y -= 34;
  center("Baked with love by Hazel.", serifItalic, 14, y, GOLD);

  const pdfBytes = await pdf.save();
  const path = `${order_id}.pdf`;

  const { error: upErr } = await supabase.storage
    .from("memory-cards")
    .upload(path, pdfBytes, { contentType: "application/pdf", upsert: true });
  if (upErr) return { status: "failed", error: `Storage: ${upErr.message}` };

  // Email it with the PDF attached
  await sendEmail(supabase, {
    customer_id: customer.id,
    template_name: "memory_card_delivery",
    reminder_type: "memory_card",
    dynamic_variables: {
      first_name: firstName(customer.full_name),
      person_name: occasion?.person_name ?? "",
      occasion_type: occasion?.occasion_type ?? "",
    },
    attachments: [{ filename: "Cake-Memory-Card.pdf", content: toBase64(pdfBytes) }],
  });

  await supabase.from("orders").update({ memory_card_sent: true }).eq("id", order_id);
  await notify(supabase, "memory_card_sent",
    `Memory card created and emailed for ${customer.full_name}`);

  return { status: "sent", url: path };
}

// Accepts either a storage path ("file.png" or "cake-photos/file.png") or a URL.
async function loadPhoto(
  supabase: SupabaseClient,
  ref: string,
): Promise<Uint8Array | null> {
  if (ref.startsWith("http")) {
    const res = await fetch(ref);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  }
  const path = ref.replace(/^cake-photos\//, "");
  const { data, error } = await supabase.storage.from("cake-photos").download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}
