"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export interface CustomerSummary {
  id: string;
  full_name: string;
  email: string;
  whatsapp_number: string | null;
  city: string | null;
  province: string | null;
  email_consent: boolean;
  whatsapp_consent: boolean;
  created_at: string;
  circle_count: number;
  order_count: number;
  active_order_count: number;
  favourite_flavour: string | null;
}

type Filter = "all" | "active" | "repeat" | "email" | "whatsapp";

export default function CustomerWall({ customers }: { customers: CustomerSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return customers.filter((customer) => {
      const matchesQuery = !needle || [
        customer.full_name,
        customer.email,
        customer.whatsapp_number,
        customer.city,
        customer.province,
        customer.favourite_flavour,
      ].some((value) => String(value || "").toLowerCase().includes(needle));
      const matchesFilter = filter === "all"
        || (filter === "active" && customer.active_order_count > 0)
        || (filter === "repeat" && customer.order_count > 1)
        || (filter === "email" && customer.email_consent)
        || (filter === "whatsapp" && customer.whatsapp_consent);
      return matchesQuery && matchesFilter;
    });
  }, [customers, filter, query]);

  return (
    <>
      <div className="customer-tools mt-6">
        <label className="customer-search">
          <span className="sr-only">Search customers</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, email, phone, place or flavour"
          />
        </label>
        <div className="customer-filters" aria-label="Filter customers">
          {([
            ["all", "All"],
            ["active", "Active orders"],
            ["repeat", "Repeat customers"],
            ["email", "Email reminders"],
            ["whatsapp", "WhatsApp reminders"],
          ] as [Filter, string][]).map(([value, label]) => (
            <button key={value} type="button" className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-sm text-muted">Showing {visible.length} of {customers.length} customers</p>

      {visible.length === 0 ? (
        <div className="surface-card surface-card--empty mt-5 p-10 text-center">
          <p className="text-creamSoft">No customers match those filters.</p>
        </div>
      ) : (
        <div className="customer-grid mt-5">
          {visible.map((customer) => (
            <Link className="customer-card" href={`/customers/${customer.id}`} key={customer.id}>
              <div className="customer-card__top">
                <span className="customer-card__initial">{customer.full_name.trim().charAt(0).toUpperCase() || "C"}</span>
                <div>
                  <h2>{customer.full_name}</h2>
                  <p>{customer.email}</p>
                </div>
              </div>
              <dl className="customer-card__stats">
                <div><dt>Circle</dt><dd>{customer.circle_count}</dd></div>
                <div><dt>Orders</dt><dd>{customer.order_count}</dd></div>
                <div><dt>Active</dt><dd>{customer.active_order_count}</dd></div>
              </dl>
              <div className="customer-card__detail">
                <p><span>Favourite</span>{customer.favourite_flavour || "Not known yet"}</p>
                <p><span>Location</span>{[customer.city, customer.province].filter(Boolean).join(", ") || "Not supplied"}</p>
              </div>
              <div className="customer-card__tags">
                {customer.email_consent && <span>Email</span>}
                {customer.whatsapp_consent && <span>WhatsApp</span>}
                {customer.active_order_count > 0 && <span>Active order</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
