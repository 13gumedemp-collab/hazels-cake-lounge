type ActivityNote = {
  type: string | null;
  message: string | null;
};

// Older runs recorded a notification even when the daily checker found nothing.
// Keep those rows as audit history, but never show them as live activity.
export function isMeaningfulActivity(note: ActivityNote): boolean {
  if (note.type !== "daily_check") return true;
  const counts = String(note.message ?? "").match(/\d+/g)?.map(Number) ?? [];
  return counts.some((count) => count > 0);
}
