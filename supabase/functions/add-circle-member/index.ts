// Public Occasion Book intake. A guest may create a new customer record, but
// must sign in before changing a record that already belongs to an account.
import {
  adminClient,
  browserJson,
  browserPreflight,
  consumeRequestRateLimit,
  firstName,
  isAllowedBrowserOrigin,
  notify,
} from "../_shared/client.ts";
import { sendEmail } from "../_shared/email.ts";

const OCCASIONS = new Map([
  ["Birthday", "Birthday"], ["Anniversary", "Anniversary"], ["Wedding", "Wedding"],
  ["Engagement", "Engagement"], ["Baby shower", "Baby shower"], ["Baptism", "Baptism"],
  ["Graduation", "Graduation"], ["Retirement", "Retirement"], ["Just because", "Just because"],
  ["Other", "Other"],
]);
const RELATIONSHIPS = new Set([
  "My child", "My partner or spouse", "My parent", "My sibling", "My friend", "My colleague", "Myself", "Other",
]);
const MAX_ITEMS = 10;
const MAX_PHOTOS = 6;

interface OccasionInput {
  person_name?: unknown;
  relationship_to_customer?: unknown;
  occasion_type?: unknown;
  occasion_other?: unknown;
  occasion_date?: unknown;
  recurring_yearly?: unknown;
  notes?: unknown;
  inspiration_photo_urls?: unknown;
}

interface Payload extends OccasionInput {
  email?: unknown;
  full_name?: unknown;
  items?: unknown;
  website?: unknown;
}

interface ValidOccasion {
  personName: string;
  relationship: string;
  occasion: string;
  date: string;
  recurring: boolean;
  notes: string;
  photoPaths: string[];
}

function clean(value: unknown, max: number): string {
  return String(value ?? "").trim().replace(/\s+/g, " ").slice(0, max);
}

function validEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254;
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function photoPaths(value: unknown): string[] | null {
  const input = Array.isArray(value) ? value : [];
  if (input.length > MAX_PHOTOS) return null;
  const paths = input.map((item) => clean(item, 140));
  return paths.every((path) => /^book-[a-z0-9]{8,}-[A-Za-z0-9._-]{1,100}$/.test(path)) ? paths : null;
}

function occasionRules(type: string, explicit: unknown) {
  if (typeof explicit === "boolean") return { recurring_yearly: explicit, is_one_time: !explicit };
  return type === "Birthday" || type === "Anniversary"
    ? { recurring_yearly: true, is_one_time: false }
    : { recurring_yearly: false, is_one_time: true };
}

function validOccasion(value: OccasionInput): ValidOccasion | null {
  const personName = clean(value.person_name, 120);
  const relationship = clean(value.relationship_to_customer, 40);
  const type = clean(value.occasion_type, 40);
  const other = clean(value.occasion_other, 80);
  const occasion = type === "Other" ? other : OCCASIONS.get(type);
  const date = clean(value.occasion_date, 10);
  const paths = photoPaths(value.inspiration_photo_urls);
  if (!personName || !RELATIONSHIPS.has(relationship) || !occasion || !validDate(date) || !paths) return null;
  return {
    personName,
    relationship,
    occasion,
    date,
    ...occasionRules(type, value.recurring_yearly),
    recurring: occasionRules(type, value.recurring_yearly).recurring_yearly,
    notes: clean(value.notes, 2000),
    photoPaths: paths,
  };
}

function labelsFor(item: ValidOccasion, customerName: string) {
  if (item.relationship === "Myself") {
    return { personName: item.personName || customerName, customerLabel: `your ${item.occasion}`, adminLabel: `their ${item.occasion}` };
  }
  if (item.personName) {
    return { personName: item.personName, customerLabel: `${item.personName}'s ${item.occasion}`, adminLabel: `${item.personName}'s ${item.occasion}` };
  }
  const possessive = ({
    "My child": "your child", "My partner or spouse": "your partner", "My parent": "your parent",
    "My sibling": "your sibling", "My friend": "your friend", "My colleague": "your colleague",
  } as Record<string, string>)[item.relationship];
  return {
    personName: item.relationship.replace(/^My /, "") || "Someone special",
    customerLabel: possessive ? `${possessive}'s ${item.occasion}` : `the ${item.occasion}`,
    adminLabel: possessive ? `${possessive.replace(/^your/, "their")}'s ${item.occasion}` : `the ${item.occasion}`,
  };
}

async function authenticatedCustomer(supabase: ReturnType<typeof adminClient>, req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token) return null;
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return null;
  const { data: customer } = await supabase
    .from("customers")
    .select("id, full_name, email")
    .eq("auth_user_id", auth.user.id)
    .maybeSingle();
  return customer || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return browserPreflight(req);
  if (!isAllowedBrowserOrigin(req)) return browserJson(req, { error: "Forbidden" }, 403);
  if (req.method !== "POST") return browserJson(req, { error: "Method not allowed" }, 405);

  let body: Payload;
  try { body = await req.json(); } catch { return browserJson(req, { error: "Please check the form and try again." }, 400); }
  if (clean(body.website, 200)) return browserJson(req, { status: "success" });

  const rawItems = Array.isArray(body.items) ? body.items : [body];
  if (!rawItems.length || rawItems.length > MAX_ITEMS || rawItems.some((item) => !item || typeof item !== "object")) {
    return browserJson(req, { error: "Please add between one and ten valid dates." }, 400);
  }
  const items = rawItems.map((item) => validOccasion(item as OccasionInput));
  if (items.some((item) => !item)) return browserJson(req, { error: "Please check each saved date and try again." }, 400);
  const occasions = items as ValidOccasion[];

  const supabase = adminClient();
  const limit = await consumeRequestRateLimit(supabase, req, "occasion_book", 3, 60 * 60);
  if (!limit.allowed) return browserJson(req, { error: "Please wait a little before saving more dates." }, 429);

  let customer = await authenticatedCustomer(supabase, req);
  if (!customer) {
    const email = clean(body.email, 254).toLowerCase();
    const fullName = clean(body.full_name, 120);
    if (!validEmail(email) || fullName.length < 2) {
      return browserJson(req, { error: "Please add your name and email so I can save the date." }, 400);
    }
    const { data: existing } = await supabase.from("customers").select("id").eq("email", email).maybeSingle();
    if (existing) {
      return browserJson(req, { error: "This email already has an account. Please sign in before changing its Occasion Book." }, 409);
    }
    const { data: created, error: createError } = await supabase
      .from("customers")
      .insert({ full_name: fullName, email, email_consent: true })
      .select("id, full_name, email")
      .single();
    if (createError || !created) return browserJson(req, { error: "I could not save your dates just now. Please try again." }, 500);
    customer = created;
  }

  const rows = occasions.map((item) => {
    const labels = labelsFor(item, customer!.full_name);
    const rules = occasionRules(item.occasion, item.recurring);
    return {
      customer_id: customer!.id,
      person_name: labels.personName,
      relationship_to_customer: item.relationship,
      occasion_type: item.occasion,
      occasion_date: item.date,
      recurring_yearly: rules.recurring_yearly,
      is_one_time: rules.is_one_time,
      notes: item.notes || null,
      photo_paths: item.photoPaths,
    };
  });
  const { data: members, error: memberError } = await supabase
    .from("circle_members")
    .insert(rows)
    .select("id, person_name, occasion_type, occasion_date, recurring_yearly");
  if (memberError || !members?.length) return browserJson(req, { error: "I could not save your dates just now. Please try again." }, 500);

  await notify(
    supabase,
    "circle_member_added",
    `${customer.full_name} added ${members.length === 1 ? "a date" : `${members.length} dates`} to their Occasion Book.`,
  );
  await Promise.allSettled(members.map((member) => sendEmail(supabase, {
    customer_id: customer!.id,
    template_name: "circle_member_added",
    reminder_type: "circle_member_added",
    circle_member_id: member.id,
    dynamic_variables: {
      first_name: firstName(customer!.full_name),
      person_name: member.person_name,
      celebration_label: `${member.person_name}'s ${member.occasion_type}`,
      occasion_type: member.occasion_type,
      occasion_date: member.occasion_date,
    },
  })));

  return browserJson(req, { status: "success", count: members.length });
});
