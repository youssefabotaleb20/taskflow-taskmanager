export function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

export function isOverdue(iso: string | null, status: string): boolean {
  if (!iso || status === "done") return false;
  const today = new Date().toISOString().slice(0, 10);
  return iso.slice(0, 10) < today;
}

/** "2026-11-03T00:00:00.000Z" → "2026-11-03" for <input type="date">. */
export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function timeAgo(iso: string, now = Date.now()): string {
  const seconds = Math.round((now - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
