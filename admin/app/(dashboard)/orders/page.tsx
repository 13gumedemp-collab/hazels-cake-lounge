import OrderBoard, { OrderCard } from "@/components/OrderBoard";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { sastToday } from "@/lib/occasions";

export const dynamic = "force-dynamic";

function daysBetween(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const today = sastToday().getTime();
  const target = new Date(dateIso + "T00:00:00Z").getTime();
  return Math.round((target - today) / 86_400_000);
}

export default async function OrdersPage() {
  const sb = supabaseAdmin();

  const { data: orders } = await sb
    .from("orders")
    .select(`
      id, status, occasion_date, cake_description, number_of_people,
      colours_and_themes, inspiration_photo_url, created_at,
      customer:customers ( full_name, email, whatsapp_number ),
      member:circle_members ( person_name, occasion_type, relationship_to_customer )
    `)
    .order("occasion_date", { ascending: true });

  const rows = orders ?? [];

  // Build a possessive celebration label, and sign any inspiration photos.
  const relPoss: Record<string, string> = {
    "My child": "your child", "My partner or spouse": "your partner", "My parent": "your parent",
    "My sibling": "your sibling", "My friend": "your friend", "My colleague": "your colleague",
  };

  const cards: OrderCard[] = await Promise.all(
    rows.map(async (o: any) => {
      const customer = o.customer || {};
      const member = o.member || {};
      const occ = member.occasion_type || "celebration";
      const name = member.person_name;
      const rel = member.relationship_to_customer || "";
      let celebration: string;
      if (rel === "Myself") celebration = `their own ${occ}`;
      else if (name && name !== "Someone special") celebration = `${name}'s ${occ}`;
      else if (relPoss[rel]) celebration = `${relPoss[rel].replace("your", "their")}'s ${occ}`;
      else celebration = `a ${occ}`;

      let photos: string[] = [];
      const raw = (o.inspiration_photo_url || "").trim();
      if (raw) {
        const paths = raw.split(",").map((s: string) => s.trim()).filter(Boolean);
        const signed = await Promise.all(
          paths.map(async (p: string) => {
            const { data } = await sb.storage.from("inspiration-photos").createSignedUrl(p, 3600);
            return data?.signedUrl || null;
          }),
        );
        photos = signed.filter(Boolean) as string[];
      }

      return {
        id: o.id,
        status: o.status || "enquiry",
        customer_name: customer.full_name || "A customer",
        customer_email: customer.email || "",
        customer_phone: customer.whatsapp_number || null,
        celebration,
        occasion_date: o.occasion_date,
        days_until: daysBetween(o.occasion_date),
        cake_description: o.cake_description,
        number_of_people: o.number_of_people,
        colours_and_themes: o.colours_and_themes,
        photos,
        created_at: o.created_at,
      };
    }),
  );

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-2">
        <div>
          <h1 className="font-serif text-3xl md:text-4xl text-cream">Order Board</h1>
          <p className="text-creamSoft mt-1">Every enquiry, from first hello to the finished cake.</p>
        </div>
        <span className="text-sm text-muted">{cards.length} order{cards.length === 1 ? "" : "s"}</span>
      </div>

      {cards.length === 0 ? (
        <div className="rounded-2xl border border-line bg-ink2/50 p-10 text-center">
          <p className="text-creamSoft">No enquiries yet. They will appear here the moment someone sends one.</p>
        </div>
      ) : (
        <OrderBoard orders={cards} />
      )}
    </div>
  );
}
