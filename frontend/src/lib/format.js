export const pct = (v, digits = 1) =>
  v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

export const num = (v, digits = 2) =>
  v == null || !Number.isFinite(v) ? "—" : Number(v).toFixed(digits);

export const int = (v) => (v == null || !Number.isFinite(v) ? "—" : Math.round(v).toString());

export const ms = (v) => (v == null || !Number.isFinite(v) ? "—" : `${Math.round(v)} ms`);

export function duration(ms) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function relativeTime(iso) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function ymd(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}
