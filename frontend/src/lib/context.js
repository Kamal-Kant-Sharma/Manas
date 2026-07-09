// Daily context logging: sleep, energy, mood, stress, caffeine.
// Correlates with cognitive performance in the Circadian page.

import { storage } from "./storage";

const KEY = "dailyContext";

export const CONTEXT_FIELDS = [
  { key: "sleepHours",   label: "Sleep",       type: "number",  min: 0,  max: 14, step: 0.5, unit: "h" },
  { key: "sleepQuality", label: "Sleep quality", type: "rating", min: 1, max: 5 },
  { key: "energy",       label: "Energy",      type: "rating",  min: 1, max: 5 },
  { key: "mood",         label: "Mood",        type: "rating",  min: 1, max: 5 },
  { key: "stress",       label: "Stress",      type: "rating",  min: 1, max: 5 },
  { key: "caffeineMg",   label: "Caffeine",    type: "number",  min: 0, max: 800, step: 25, unit: "mg" },
];

function ymd(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function loadContextMap() {
  return storage.get(KEY, {});
}
export function saveContextMap(map) { storage.set(KEY, map); }

export function getContext(date) {
  const map = loadContextMap();
  return map[date] || null;
}

export function setContext(date, patch) {
  const map = loadContextMap();
  const cur = map[date] || {};
  map[date] = { ...cur, ...patch, updatedAt: new Date().toISOString() };
  saveContextMap(map);
  return map[date];
}

export function todayKey() { return ymd(); }

// Correlate a session-level metric with a context field. Returns Pearson r.
export function correlate(sessions, contextMap, contextField, metricFn) {
  const pairs = [];
  for (const s of sessions) {
    const key = ymd(s.createdAt);
    const c = contextMap[key];
    if (!c) continue;
    const cv = c[contextField];
    if (cv == null) continue;
    const mv = metricFn(s);
    if (mv == null || !Number.isFinite(mv)) continue;
    pairs.push([cv, mv]);
  }
  if (pairs.length < 3) return { n: pairs.length, r: null, pairs };
  const n = pairs.length;
  const meanX = pairs.reduce((s, p) => s + p[0], 0) / n;
  const meanY = pairs.reduce((s, p) => s + p[1], 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (const [x, y] of pairs) {
    num += (x - meanX) * (y - meanY);
    dx += (x - meanX) ** 2;
    dy += (y - meanY) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  const r = denom > 0 ? num / denom : 0;
  return { n, r, pairs };
}
