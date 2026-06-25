// Shared helpers for working out the next occurrence of a recurring occasion.
const DAY = 86_400_000;

export function sastToday(): Date {
  const s = new Date(Date.now() + 2 * 3600 * 1000);
  return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
}

export function nextOccurrence(occasionDate: string, from = sastToday()): Date {
  const [, mm, dd] = occasionDate.split("-").map(Number);
  const thisYear = new Date(Date.UTC(from.getUTCFullYear(), mm - 1, dd));
  return thisYear.getTime() >= from.getTime()
    ? thisYear
    : new Date(Date.UTC(from.getUTCFullYear() + 1, mm - 1, dd));
}

export function daysUntil(occasionDate: string, from = sastToday()): number {
  return Math.round((nextOccurrence(occasionDate, from).getTime() - from.getTime()) / DAY);
}

export function prettyDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d + "T00:00:00Z") : d;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export const OCCASION_COLOURS: Record<string, string> = {
  Birthday: "#C9A84C",
  Wedding: "#F5F0E8",
  Anniversary: "#C9A484",
  "Baby Shower": "#84A4C9",
  Graduation: "#84C9A4",
  "Just Because": "#888888",
  Other: "#888888",
};
