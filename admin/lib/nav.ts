export type BadgeKey = "occasions" | "orders" | "whatsapp" | null;

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge: BadgeKey;
}

export const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: "home", badge: null },
  { href: "/occasions", label: "Occasions", icon: "calendar", badge: "occasions" },
  { href: "/orders", label: "Orders", icon: "kanban", badge: "orders" },
  { href: "/customers", label: "Customers", icon: "people", badge: null },
  { href: "/whatsapp", label: "WhatsApp", icon: "whatsapp", badge: "whatsapp" },
  { href: "/messages", label: "Messages", icon: "mail", badge: null },
  { href: "/reminders", label: "Reminders", icon: "bell", badge: null },
  { href: "/analytics", label: "Analytics", icon: "chart", badge: null },
  { href: "/settings", label: "Settings", icon: "gear", badge: null },
];
