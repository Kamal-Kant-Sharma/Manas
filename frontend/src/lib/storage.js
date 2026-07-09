// Simple localStorage wrapper with JSON + safe fallbacks.
// Everything the app writes goes through here. Keys are namespaced.

const NS = "neuroforge:v1:";

export const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(NS + key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(NS + key, JSON.stringify(value));
    } catch (e) {
      // Quota exceeded or serialization error — surface but don't crash
      console.warn("[storage.set] failed", key, e);
    }
  },
  remove(key) {
    try { localStorage.removeItem(NS + key); } catch {}
  },
  keys() {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(NS)) out.push(k.slice(NS.length));
    }
    return out;
  },
  clearAll() {
    this.keys().forEach((k) => this.remove(k));
  },
};

export function uid() {
  // 12-char base36 id from crypto if available
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const b = new Uint8Array(9);
    crypto.getRandomValues(b);
    return Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("").slice(0, 12);
  }
  return Math.random().toString(36).slice(2, 14);
}
