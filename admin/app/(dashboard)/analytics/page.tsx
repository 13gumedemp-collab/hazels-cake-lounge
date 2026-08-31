import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

interface BarPoint { label: string; value: number }

function Bars({ points, format = (value: number) => String(value) }: { points: BarPoint[]; format?: (value: number) => string }) {
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="analytics-bars">
      {points.map((point) => (
        <div key={point.label}>
          <span>{point.label}</span>
          <i><b style={{ width: `${(point.value / max) * 100}%` }} /></i>
          <strong>{format(point.value)}</strong>
        </div>
      ))}
    </div>
  );
}

function countBy(values: string[]) {
  return Object.entries(values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));
}

export default async function AnalyticsPage() {
  const sb = supabaseAdmin();
  const [{ data: customers }, { data: occasions }, { data: orders }] = await Promise.all([
    sb.from("customers").select("id, created_at, email_consent, whatsapp_consent"),
    sb.from("circle_members").select("occasion_type"),
    sb.from("orders").select("id, customer_id, cake_flavour, status, created_at, total_amount_zar"),
  ]);
  const customerRows = customers || [];
  const orderRows = orders || [];

  const monthStarts = Array.from({ length: 12 }, (_, index) => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (11 - index), 1));
  });
  const customerGrowth = monthStarts.map((date) => ({
    label: date.toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" }),
    value: customerRows.filter((customer) => new Date(customer.created_at) <= new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59))).length,
  }));
  const ordersByMonth = monthStarts.map((date) => ({
    label: date.toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" }),
    value: orderRows.filter((order) => {
      const created = new Date(order.created_at);
      return created.getUTCFullYear() === date.getUTCFullYear() && created.getUTCMonth() === date.getUTCMonth();
    }).length,
  }));
  const occasionTypes = countBy((occasions || []).map((occasion) => occasion.occasion_type || "Other")).slice(0, 8);
  const flavours = countBy(orderRows.map((order) => order.cake_flavour).filter(Boolean) as string[]).slice(0, 8);
  const ordersPerCustomer = orderRows.reduce<Record<string, number>>((counts, order) => {
    if (order.customer_id) counts[order.customer_id] = (counts[order.customer_id] || 0) + 1;
    return counts;
  }, {});
  const orderingCustomers = Object.values(ordersPerCustomer).length;
  const repeatCustomers = Object.values(ordersPerCustomer).filter((count) => count > 1).length;
  const repeatRate = orderingCustomers ? Math.round((repeatCustomers / orderingCustomers) * 100) : 0;
  const activeOrders = orderRows.filter((order) => order.status !== "completed").length;
  const quotedValue = orderRows.reduce((sum, order) => sum + Number(order.total_amount_zar || 0), 0);
  const emailConsent = customerRows.filter((customer) => customer.email_consent).length;
  const whatsappConsent = customerRows.filter((customer) => customer.whatsapp_consent).length;
  const money = new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 });

  return (
    <div className="admin-page max-w-[1500px] mx-auto">
      <div className="page-heading"><p className="eyebrow">Business view</p><h1>Analytics</h1><p className="text-creamSoft mt-2">Customers, orders and the celebrations shaping the kitchen.</p></div>

      <section className="analytics-metrics mt-6">
        <article><span>Total customers</span><strong>{customerRows.length}</strong><small>{customerGrowth.at(-1)?.value || 0} to date</small></article>
        <article><span>Orders recorded</span><strong>{orderRows.length}</strong><small>{activeOrders} active</small></article>
        <article><span>Repeat rate</span><strong>{repeatRate}%</strong><small>{repeatCustomers} repeat customers</small></article>
        <article><span>Quoted order value</span><strong>{money.format(quotedValue)}</strong><small>Across recorded orders</small></article>
      </section>

      <div className="analytics-grid mt-5">
        <section className="surface-card analytics-panel analytics-panel--wide"><div><p className="eyebrow">Growth</p><h2>Customers over time</h2></div><Bars points={customerGrowth} /></section>
        <section className="surface-card analytics-panel"><div><p className="eyebrow">Demand</p><h2>Orders by month</h2></div><Bars points={ordersByMonth} /></section>
        <section className="surface-card analytics-panel"><div><p className="eyebrow">Celebrations</p><h2>Popular occasions</h2></div>{occasionTypes.length ? <Bars points={occasionTypes} /> : <p className="analytics-empty">No occasion data yet.</p>}</section>
        <section className="surface-card analytics-panel"><div><p className="eyebrow">Taste</p><h2>Popular flavours</h2></div>{flavours.length ? <Bars points={flavours} /> : <p className="analytics-empty">Flavours will appear once they are added to orders.</p>}</section>
        <section className="surface-card analytics-panel consent-panel">
          <div><p className="eyebrow">Permissions</p><h2>Reminder consent</h2></div>
          <div className="consent-ring-grid">
            <div style={{ "--percent": `${customerRows.length ? Math.round(emailConsent / customerRows.length * 100) : 0}%` } as React.CSSProperties}><i><strong>{emailConsent}</strong><span>Email</span></i></div>
            <div style={{ "--percent": `${customerRows.length ? Math.round(whatsappConsent / customerRows.length * 100) : 0}%` } as React.CSSProperties}><i><strong>{whatsappConsent}</strong><span>WhatsApp</span></i></div>
          </div>
          <p>{customerRows.length - emailConsent} customers have email reminders off. {customerRows.length - whatsappConsent} have WhatsApp reminders off.</p>
        </section>
      </div>
    </div>
  );
}
