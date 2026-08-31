import CustomerWall, { CustomerSummary } from "@/components/CustomerWall";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const { data } = await supabaseAdmin()
    .from("customers")
    .select(`
      id, full_name, email, whatsapp_number, city, province, email_consent, whatsapp_consent, created_at,
      circle_members ( id ),
      orders ( id, status, cake_flavour )
    `)
    .order("created_at", { ascending: false });

  const customers: CustomerSummary[] = (data || []).map((row: any) => {
    const orders = row.orders || [];
    const flavours = orders.map((order: any) => order.cake_flavour).filter(Boolean) as string[];
    const favourite = flavours.reduce<Record<string, number>>((counts, flavour) => {
      counts[flavour] = (counts[flavour] || 0) + 1;
      return counts;
    }, {});
    const favouriteFlavour = Object.entries(favourite).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      whatsapp_number: row.whatsapp_number,
      city: row.city,
      province: row.province,
      email_consent: row.email_consent,
      whatsapp_consent: row.whatsapp_consent,
      created_at: row.created_at,
      circle_count: row.circle_members?.length || 0,
      order_count: orders.length,
      active_order_count: orders.filter((order: any) => order.status !== "completed").length,
      favourite_flavour: favouriteFlavour,
    };
  });

  return (
    <div className="admin-page max-w-7xl mx-auto">
      <div className="page-heading">
        <p className="eyebrow">Relationships</p>
        <h1>Customer Wall</h1>
        <p className="text-creamSoft mt-2">Every customer, the people they celebrate and the cakes you have made together.</p>
      </div>
      <CustomerWall customers={customers} />
    </div>
  );
}
