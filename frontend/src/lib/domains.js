// Cognitive domain registry + generic scoring engine.
// Modular: add a new domain by pushing to COGNITIVE_DOMAINS.
// Task modules declare `domainContributions: { [domainId]: weight (0..1) }`.
// The scoring algorithm is intentionally simple so it can be swapped later.

import { getTask } from "../tasks/registry";

// Virtual tasks — data sources that aren't in the task registry but should
// contribute to cognitive domain scores (e.g., the Daily Delayed Recall feature).
const VIRTUAL_TASKS = {
  dailyRecall: {
    id: "dailyRecall",
    name: "Daily Recall",
    domainContributions: { longTermMemory: 1.0, shortTermMemory: 0.2 },
  },
};

function getTaskLike(id) { return getTask(id) || VIRTUAL_TASKS[id] || null; }

export const COGNITIVE_DOMAINS = [
  { id: "workingMemory",       label: "Working Memory" },
  { id: "shortTermMemory",     label: "Short-Term Memory" },
  { id: "longTermMemory",      label: "Long-Term Memory" },
  { id: "attention",           label: "Attention" },
  { id: "sustainedAttention",  label: "Sustained Attention" },
  { id: "selectiveAttention",  label: "Selective Attention" },
  { id: "executiveFunction",   label: "Executive Function" },
  { id: "cognitiveFlexibility",label: "Cognitive Flexibility" },
  { id: "processingSpeed",     label: "Processing Speed" },
  { id: "inhibitoryControl",   label: "Inhibitory Control" },
  { id: "spatialMemory",       label: "Spatial Memory" },
  { id: "spatialReasoning",    label: "Spatial Reasoning" },
  { id: "mentalArithmetic",    label: "Mental Arithmetic" },
  { id: "reasoning",           label: "Reasoning" },
  { id: "cognitiveConsistency",label: "Cognitive Consistency" },
];

export function domainLabel(id) {
  return COGNITIVE_DOMAINS.find((d) => d.id === id)?.label || id;
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// --------- Task-specific difficulty multiplier ---------
// Higher difficulty = higher weight assigned to the resulting session score.
export function difficultyMultiplier(session) {
  const cfg = session?.config || {};
  switch (session?.taskId) {
    case "nback":         return 1 + (Math.max(1, cfg.n || 2) - 2) * 0.15;   // n=2 → 1.0, n=6 → 1.6
    case "pasat":         return (1 + (Math.max(2, cfg.windowSize || 2) - 2) * 0.1) * (2500 / Math.max(500, cfg.intervalMs || 2400));
    case "memorySpan":    return 1 + Math.max(0, (session?.summary?.maxSpan || 0) - 5) * 0.08;
    case "taskSwitching": return 1 + (Math.max(0, (cfg.switchProbability || 0.5) - 0.5)) * 0.8;
    case "ospan":         return 1 + Math.max(0, (session?.summary?.maxSpan || 0) - 3) * 0.1;
    case "corsi":         return 1 + Math.max(0, (session?.summary?.maxSpan || 0) - 4) * 0.1;
    default:              return 1;
  }
}

// --------- Session → normalized score (0..100) ---------
export function sessionScore(session) {
  if (!session?.summary) return null;
  const acc = clamp(session.summary?.metrics?.accuracy ?? 0, 0, 1);
  const rt  = session.summary?.rt?.mean;
  // RT normalized: 300ms = perfect, 3000ms+ = poor. Only used if RT is meaningful.
  const rtNorm = Number.isFinite(rt) ? clamp((3000 - rt) / 2700, 0, 1) : 0.5;
  const stdev = session.summary?.rt?.stdev;
  const consistency = Number.isFinite(stdev) && Number.isFinite(rt) && rt > 0
    ? clamp(1 - Math.min(stdev / rt, 1), 0, 1)
    : 0.5;
  const base = acc * 0.55 + rtNorm * 0.25 + consistency * 0.20;
  const mult = difficultyMultiplier(session);
  // Cap the raw score so easy-mode grinds cannot inflate profile.
  return clamp(base * mult * 100, 0, 100);
}

// --------- Recency weight (exponential decay) ---------
function recencyWeight(session, halfLifeDays = 10) {
  const ageDays = (Date.now() - new Date(session.createdAt).getTime()) / 86400000;
  return Math.pow(0.5, ageDays / halfLifeDays);
}

// --------- Domain aggregation ---------
// options.rangeDays: only include sessions within N days (null = all time)
// options.exclude: number of days to exclude from most recent (for trend comparison)
export function computeDomainScores(sessions, opts = {}) {
  const { rangeDays = 30, excludeRecentDays = 0, halfLifeDays = 10 } = opts;
  const now = Date.now();
  const filtered = sessions.filter((s) => {
    const age = (now - new Date(s.createdAt).getTime()) / 86400000;
    if (age < excludeRecentDays) return false;
    if (rangeDays != null && age > rangeDays + excludeRecentDays) return false;
    return true;
  });

  const out = {};
  for (const d of COGNITIVE_DOMAINS) {
    let wsum = 0, wsc = 0, count = 0;
    for (const s of filtered) {
      const task = getTaskLike(s.taskId);
      const weight = task?.domainContributions?.[d.id];
      if (!weight) continue;
      const score = sessionScore(s);
      if (score == null) continue;
      const recency = recencyWeight(s, halfLifeDays);
      const w = weight * recency;
      wsum += w;
      wsc  += score * w;
      count++;
    }
    out[d.id] = wsum > 0
      ? { score: wsc / wsum, contributions: count, weight: wsum }
      : { score: null, contributions: 0, weight: 0 };
  }
  return out;
}

// Overall cognitive score = weighted mean across domains that have data.
export function overallCognitiveScore(domainScores) {
  const values = Object.values(domainScores).filter((d) => d.score != null);
  if (!values.length) return null;
  const wsum = values.reduce((s, d) => s + d.weight, 0);
  return wsum > 0 ? values.reduce((s, d) => s + d.score * d.weight, 0) / wsum : null;
}

// Compare current window vs previous window → trend per domain.
export function computeDomainTrends(sessions, opts = {}) {
  const windowDays = opts.windowDays ?? 14;
  const current = computeDomainScores(sessions, { rangeDays: windowDays, halfLifeDays: 7 });
  const previous = computeDomainScores(sessions, { rangeDays: windowDays, excludeRecentDays: windowDays, halfLifeDays: 7 });
  const out = {};
  for (const d of COGNITIVE_DOMAINS) {
    const c = current[d.id]?.score;
    const p = previous[d.id]?.score;
    const delta = c != null && p != null ? c - p : null;
    out[d.id] = { current: c, previous: p, delta, contributions: current[d.id]?.contributions || 0 };
  }
  return out;
}

// Series of daily overall/domain snapshots over the past N days (for trend graph).
export function computeSnapshotSeries(sessions, days = 30) {
  const series = [];
  const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const anchor = new Date(now.getTime() - i * 86400000);
    const cutoff = anchor.getTime() + 86400000;
    const upto = sessions.filter((s) => new Date(s.createdAt).getTime() < cutoff);
    const ds = computeDomainScores(upto, { rangeDays: 30, halfLifeDays: 10 });
    const overall = overallCognitiveScore(ds);
    series.push({
      date: anchor.toISOString().slice(0, 10),
      overall,
      ...Object.fromEntries(COGNITIVE_DOMAINS.map((d) => [d.id, ds[d.id]?.score ?? null])),
    });
  }
  return series;
}
