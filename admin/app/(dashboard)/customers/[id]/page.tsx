import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { prettyDate } from "@/lib/occasions";

export const dynamic = "force-dynamic";

const money = (value: number | null) => value == null
  ? "Not set"
  : new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(value);

function dateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Johannesburg" });
}

export default async function CustomerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id: customerId } = await params;
  const sb = supabaseAdmin();
  const [customerResult, circleResult, ordersResult, messagesResult, whatsappResult, callsResult, loginResult] = await Promise.all([
    sb.from("customers").select("*").eq("id", customerId).maybeSingle(),
    sb.from("circle_members").select("*").eq("customer_id", customerId).order("occasion_date"),
    sb.from("orders").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    sb.from("reminder_log").select("*").eq("customer_id", customerId).order("sent_at", { ascending: false }).limit(100),
    sb.from("whatsapp_reminders_due").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    sb.from("phone_call_reminders_due").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    sb.from("customer_login_activity").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(12),
  ]);

  const customer = customerResult.data;
  if (!customer) notFound();
  const circle = circleResult.data || [];
  const orders = ordersResult.data || [];
  const messages = messagesResult.data || [];
  const whatsapp = whatsappResult.data || [];
  const calls = callsResult.data || [];
  const logins = loginResult.data || [];

  const signedCircle = await Promise.all(circle.map(async (member: any) => {
    const photos = await Promise.all((member.photo_paths || []).map(async (path: string) => {
      const { data } = await sb.storage.from("inspiration-photos").createSignedUrl(path, 3600);
      return data?.signedUrl || null;
    }));
    return { ...member, photos: photos.filter(Boolean) as string[] };
  }));

  const address = [customer.address_line_1, customer.address_line_2, customer.suburb, customer.city, customer.province, customer.postal_code].filter(Boolean).join(", ");

  return (
    <div className="admin-page max-w-7xl mx-auto">
      <Link href="/customers" className="text-sm text-gold hover:underline">Back to customers</Link>
      <section className="customer-profile-hero mt-4">
        <span className="customer-profile-hero__initial">{customer.full_name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0">
          <p className="eyebrow">Customer profile</p>
          <h1>{customer.full_name}</h1>
          <p>{customer.email}{customer.whatsapp_number ? ` · ${customer.whatsapp_number}` : ""}</p>
        </div>
        <div className="customer-profile-hero__tags">
          <span className={customer.email_consent ? "is-on" : ""}>Email {customer.email_consent ? "on" : "off"}</span>
          <span className={customer.whatsapp_consent ? "is-on" : ""}>WhatsApp {customer.whatsapp_consent ? "on" : "off"}</span>
          <span className="is-on">Phone service on</span>
        </div>
      </section>

      <div className="profile-summary-grid mt-6">
        <section className="surface-card p-5">
          <p className="eyebrow">Details</p>
          <dl className="profile-list mt-4">
            <div><dt>Address</dt><dd>{address || "Not supplied"}</dd></div>
            <div><dt>Birthday</dt><dd>{customer.own_birthday ? prettyDate(customer.own_birthday) : "Not supplied"}</dd></div>
            <div><dt>Joined</dt><dd>{dateTime(customer.created_at)}</dd></div>
            <div><dt>Last sign in</dt><dd>{logins[0] ? dateTime(logins[0].created_at) : "Not recorded"}</dd></div>
          </dl>
        </section>
        <section className="surface-card p-5">
          <p className="eyebrow">At a glance</p>
          <dl className="profile-metrics mt-4">
            <div><dt>Circle</dt><dd>{circle.length}</dd></div>
            <div><dt>Orders</dt><dd>{orders.length}</dd></div>
            <div><dt>Messages</dt><dd>{messages.length}</dd></div>
            <div><dt>WhatsApp tasks</dt><dd>{whatsapp.filter((task: any) => task.status === "pending").length}</dd></div>
          </dl>
        </section>
        <section className="surface-card p-5">
          <p className="eyebrow">Hazel&apos;s notes</p>
          <p className="mt-4 text-sm text-creamSoft whitespace-pre-wrap">{customer.notes || "No customer notes yet."}</p>
        </section>
      </div>

      <section className="mt-8">
        <div className="section-heading"><div><p className="eyebrow">People and dates</p><h2>Their Circle</h2></div><span>{signedCircle.length}</span></div>
        {signedCircle.length === 0 ? <div className="surface-card surface-card--empty p-8 text-center">No saved dates yet.</div> : (
          <div className="profile-circle-grid">
            {signedCircle.map((member: any) => (
              <article className="surface-card profile-circle-card" key={member.id}>
                {member.photos[0] && <img src={member.photos[0]} alt="" />}
                <div className="p-5">
                  <p className="eyebrow">{member.relationship_to_customer || "Someone special"}</p>
                  <h3>{member.person_name}</h3>
                  <p>{member.occasion_type} · {prettyDate(member.occasion_date)}</p>
                  <span className="profile-pill">{member.recurring_yearly ? "Repeats yearly" : "One time"}</span>
                  {member.notes && <p className="mt-3 text-sm text-muted whitespace-pre-wrap">{member.notes}</p>}
                  {member.photos.length > 1 && <p className="mt-2 text-xs text-muted">{member.photos.length} saved pictures</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="section-heading"><div><p className="eyebrow">Kitchen history</p><h2>Orders</h2></div><span>{orders.length}</span></div>
        <div className="profile-table surface-card">
          {orders.length === 0 ? <p className="p-8 text-center text-muted">No orders yet.</p> : orders.map((order: any) => (
            <div className="profile-table__row" key={order.id}>
              <div><strong>{order.cake_description || order.cake_flavour || "Cake order"}</strong><span>{dateTime(order.created_at)}</span></div>
              <div><span>{order.status || "enquiry"}</span><strong>{money(order.total_amount_zar)}</strong></div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-5 mt-8">
        <section>
          <div className="section-heading"><div><p className="eyebrow">Delivery history</p><h2>Messages</h2></div><span>{messages.length}</span></div>
          <div className="profile-timeline surface-card">
            {messages.length === 0 ? <p>No message history yet.</p> : messages.slice(0, 20).map((message: any) => (
              <article key={message.id} className={`is-${message.status}`}>
                <div><strong>{String(message.reminder_type || "Message").replaceAll("_", " ")}</strong><span>{dateTime(message.sent_at)}</span></div>
                <p>{message.channel || "email"} · {message.status}</p>
                {message.error_message && <small>{message.error_message}</small>}
              </article>
            ))}
          </div>
        </section>
        <section>
          <div className="section-heading"><div><p className="eyebrow">Manual service</p><h2>Contact tasks</h2></div><span>{whatsapp.length + calls.length}</span></div>
          <div className="profile-timeline surface-card">
            {[...whatsapp.map((task: any) => ({ ...task, channel: "WhatsApp" })), ...calls.map((task: any) => ({ ...task, channel: "Phone call" }))]
              .sort((a: any, b: any) => String(b.created_at).localeCompare(String(a.created_at)))
              .slice(0, 20)
              .map((task: any) => (
                <article key={`${task.channel}-${task.id}`}>
                  <div><strong>{task.channel}</strong><span>{task.due_date ? prettyDate(task.due_date) : dateTime(task.created_at)}</span></div>
                  <p>{String(task.reminder_type || "Reminder").replaceAll("_", " ")} · {task.status}</p>
                </article>
              ))}
            {!whatsapp.length && !calls.length && <p>No contact tasks yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
