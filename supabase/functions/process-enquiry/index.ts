// Public cake enquiry intake. This path is deliberately defensive because it
// accepts contact details from an unauthenticated visitor.
import {
  adminClient,
  browserJson,
  browserPreflight,
  consumeRequestRateLimit,
  firstName,
  isAllowedBrowserOrigin,
  notify,
} from "../_shared/client.ts";
import { sendEmail, sendToAddress } from "../_shared/email.ts";

const OCCASIONS = new Map([
  ["Birthday", "Birthday"], ["Anniversary", "Anniversary"], ["Wedding", "Wedding"],
  ["Engagement", "Engagement"], ["Baby shower", "Baby shower"], ["Baptism", "Baptism"],
  ["Graduation", "Graduation"], ["Retirement", "Retirement"], ["Just because", "Just because"],
  ["Other", "Other"],
]);
const RELATIONSHIPS = new Set([
  "My child", "My partner or spouse", "My parent", "My sibling", "My friend", "My colleague", "Myself", "Other",
]);
const MAX_PHOTOS = 6;

interface Payload {
  full_name?: unknown;
  email?: unknown;
  whatsapp_number?: unknown;
  occasion_for?: unknown;
  relationship_to_customer?: unknown;
  occasion_type?: unknown;
  occasion_other?: unknown;
  occasion_date?: unknown;
  cake_description?: unknown;
  number_of_people?: unknown;
  colours_and_themes?: unknown;
  inspiration_photo_url?: unknown;
  inspiration_photo_urls?: unknown;
  email_consent?: unknown;
  whatsapp_consent?: unknown;
  occasion_book_opted_in?: unknown;
  website?: unknown;
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254;
}

function validPhone(phone: string): boolean {
  return !phone || /^[+()\d\s-]{7,24}$/.test(phone);
}

function validCakeDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const earliest = new Date();
  earliest.setHours(0, 0, 0, 0);
  earliest.setDate(earliest.getDate() + 4);
  return date >= earliest;
}

function acceptedPhotoPaths(value: unknown): string[] | null {
  const input = Array.isArray(value) ? value : [];
  if (input.length > MAX_PHOTOS) return null;
  const paths = input.map((item) => clean(item, 140));
  return paths.every((path) => /^enq-[a-z0-9]{8,}-[A-Za-z0-9._-]{1,100}$/.test(path)) ? paths : null;
}

function occasionRules(type: string): { recurring_yearly: boolean; is_one_time: boolean } {
  return type === "Birthday" || type === "Anniversary"
    ? { recurring_yearly: true, is_one_time: false }
    : { recurring_yearly: false, is_one_time: true };
}

function relationshipPossessive(relationship: string): string {
  return ({
    "My child": "your child", "My partner or spouse": "your partner", "My parent": "your parent",
    "My sibling": "your sibling", "My friend": "your friend", "My colleague": "your colleague",
  } as Record<string, string>)[relationship] || "";
}

function buildLabels(options: { name: string; relationship: string; occasion: string; customerName: string }) {
  const { name, relationship, occasion, customerName } = options;
  let celebrationLabel: string;
  let personName: string;
  if (relationship === "Myself") {
    celebrationLabel = `your ${occasion}`;
    personName = name || customerName;
  } else if (name) {
    celebrationLabel = `${name}'s ${occasion}`;
    personName = name;
  } else {
    const possessive = relationshipPossessive(relationship);
    celebrationLabel = possessive ? `${possessive}'s ${occasion}` : `the ${occasion}`;
    personName = relationship ? relationship.replace(/^My /, "") : "Someone special";
  }
  return {
    celebrationLabel,
    celebrationLabelTheir: celebrationLabel.replace(/^your\b/, "their").replace(/\byour /g, "their "),
    personName,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return browserPreflight(req);
  if (!isAllowedBrowserOrigin(req)) return browserJson(req, { error: "Forbidden" }, 403);
  if (req.method !== "POST") return browserJson(req, { error: "Method not allowed" }, 405);

  let payload: Payload;
  try { payload = await req.json(); } catch { return browserJson(req, { error: "Please check the form and try again." }, 400); }
  // A hidden field that a person never sees. Silently accepting it prevents a
  // bot from learning which part of its submission was detected.
  if (clean(payload.website, 200)) return browserJson(req, { status: "success" });

  const supabase = adminClient();
  const limit = await consumeRequestRateLimit(supabase, req, "enquiry", 3, 60 * 60);
  if (!limit.allowed) {
    return browserJson(req, { error: "Please wait a little before sending another enquiry." }, 429);
  }

  const fullName = clean(payload.full_name, 120);
  const email = clean(payload.email, 254).toLowerCase();
  const phone = clean(payload.whatsapp_number, 24);
  const relationship = clean(payload.relationship_to_customer, 40);
  const type = clean(payload.occasion_type, 40);
  const occasionDate = clean(payload.occasion_date, 10);
  const otherOccasion = clean(payload.occasion_other, 80);
  const occasion = type === "Other" ? otherOccasion : OCCASIONS.get(type);
  const photoPaths = acceptedPhotoPaths(payload.inspiration_photo_urls);
  if (
    fullName.length < 2 || !validEmail(email) || !validPhone(phone) || !occasion ||
    !validCakeDate(occasionDate) || !RELATIONSHIPS.has(relationship) || !photoPaths
  ) {
    return browserJson(req, { error: "Please check the required details and try again." }, 400);
  }

  const cakeDescription = clean(payload.cake_description, 3000);
  const people = clean(payload.number_of_people, 80);
  const colours = clean(payload.colours_and_themes, 800);
  const personName = clean(payload.occasion_for, 120);
  const emailConsent = payload.email_consent !== false;
  const whatsappConsent = payload.whatsapp_consent === true;
  const rules = occasionRules(type);

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .upsert({
      full_name: fullName,
      email,
      whatsapp_number: phone || null,
      email_consent: emailConsent,
      whatsapp_consent: whatsappConsent,
      whatsapp_consent_date: whatsappConsent ? new Date().toISOString() : null,
    }, { onConflict: "email" })
    .select("id, full_name, email, whatsapp_number")
    .single();
  if (customerError || !customer) return browserJson(req, { error: "I could not save your enquiry just now. Please try again." }, 500);

  const labels = buildLabels({ name: personName, relationship, occasion, customerName: customer.full_name });
  const { data: member, error: memberError } = await supabase
    .from("circle_members")
    .insert({
      customer_id: customer.id,
      person_name: labels.personName,
      relationship_to_customer: relationship,
      occasion_type: occasion,
      occasion_date: occasionDate,
      recurring_yearly: payload.occasion_book_opted_in === false ? false : rules.recurring_yearly,
      is_one_time: rules.is_one_time,
      notes: cakeDescription || null,
    })
    .select("id, person_name, occasion_type, occasion_date, recurring_yearly")
    .single();
  if (memberError || !member) return browserJson(req, { error: "I could not save your enquiry just now. Please try again." }, 500);

  const { error: orderError } = await supabase.from("orders").insert({
    customer_id: customer.id,
    circle_member_id: member.id,
    cake_description: cakeDescription || null,
    inspiration_photo_url: photoPaths.join(",") || null,
    number_of_people: people || null,
    colours_and_themes: colours || null,
    order_date: new Date().toISOString().slice(0, 10),
    occasion_date: occasionDate,
    status: "enquiry",
  });
  if (orderError) return browserJson(req, { error: "I could not save your enquiry just now. Please try again." }, 500);

  await notify(
    supabase,
    "new_enquiry",
    `New enquiry from ${customer.full_name} for ${labels.celebrationLabelTheir} on ${member.occasion_date}.`,
    "high",
    "/orders",
  );

  const variables = {
    first_name: firstName(customer.full_name),
    customer_name: customer.full_name,
    customer_email: customer.email,
    customer_phone: customer.whatsapp_number ?? "",
    person_name: member.person_name,
    celebration_label: labels.celebrationLabel,
    celebration_label_their: labels.celebrationLabelTheir,
    relationship,
    occasion_type: member.occasion_type,
    occasion_date: member.occasion_date,
    customer_notes: cakeDescription,
    number_of_people: people,
    occasion_book_opted_in: member.recurring_yearly ? "yes" : "",
    whatsapp_opted_in: whatsappConsent ? "yes" : "",
    occasion_book_status: member.recurring_yearly ? "Opted in" : "Not opted in",
    whatsapp_status: whatsappConsent ? "Opted in" : "Not opted in",
  };
  const businessEmail = Deno.env.get("BUSINESS_EMAIL") ?? "hello@hazelscakelounge.co.za";
  await Promise.allSettled([
    sendEmail(supabase, {
      customer_id: customer.id,
      template_name: "enquiry_acknowledgement",
      reminder_type: "enquiry_acknowledgement",
      circle_member_id: member.id,
      dynamic_variables: variables,
    }),
    sendToAddress(businessEmail, "new_enquiry_alert", variables, supabase),
  ]);

  return browserJson(req, {
    status: "success",
    first_name: firstName(customer.full_name),
    person_name: member.person_name,
    celebration_label: labels.celebrationLabel,
    occasion_type: member.occasion_type,
    occasion_date: member.occasion_date,
    occasion_book_opted_in: member.recurring_yearly,
  });
});
