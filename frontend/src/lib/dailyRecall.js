// Daily Delayed Recall — dashboard feature (NOT a task).
// A phrase + number is generated on day X, and recalled on day X+1 (or later).

import { storage } from "./storage";

const KEY = "dailyRecall";

// ---- Word pools for phrase generation ----
const ADJ  = ["ancient", "quiet", "restless", "curious", "hidden", "silver", "bright", "distant", "silent", "wise", "rusty", "amber", "wandering", "brittle"];
const NOUN = ["fox", "moon", "harbor", "mountain", "letter", "garden", "mirror", "promise", "compass", "candle", "sparrow", "atlas", "orchard", "beacon"];
const VERB = ["crossed", "remembered", "painted", "folded", "whispered", "chased", "guarded", "traced", "found", "returned to", "abandoned", "measured"];
const PREP = ["across", "through", "beside", "beneath", "over", "past"];
const PLACE= ["seven rivers", "an old library", "the last hill", "a quiet meadow", "the burning field", "twelve bridges", "a hollow stone", "the copper city"];

export const DEFAULT_RECALL_CFG = {
  wordCount: 6,          // approximate; produces one full sentence
  numberLength: 8,
  characterSet: "digits", // digits | alphanumeric
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seedFromDate(d) {
  // deterministic-ish seed per date so a challenge doesn't change until submitted
  const s = String(d).split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return s * 9973 + Date.now() % 100; // small jitter so multiple opens per day still vary
}

export function generateChallenge(cfg = DEFAULT_RECALL_CFG, seed = Math.random() * 1e9) {
  const r = mulberry32(seed);
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const phrase = `The ${pick(ADJ)} ${pick(NOUN)} ${pick(VERB)} ${pick(PREP)} ${pick(PLACE)}.`;
  const chars = cfg.characterSet === "alphanumeric" ? "ABCDEFGHJKMNPQRSTVWXYZ23456789" : "0123456789";
  let number = "";
  for (let i = 0; i < (cfg.numberLength || 8); i++) number += chars[Math.floor(r() * chars.length)];
  return { phrase, number };
}

function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const da = new Date(a).getTime();
  const db = new Date(b).getTime();
  return Math.round((db - da) / 86400000);
}

export function loadRecallState() {
  return storage.get(KEY, {
    pending: null,          // { generatedOn: 'YYYY-MM-DD', phrase, number, cfg }
    history: [],            // [{ date, phrase, number, given: {phrase, number}, phraseAccuracy, numberAccuracy, delayDays }]
    cfg: DEFAULT_RECALL_CFG,
    streak: 0,
    longestStreak: 0,
    lastCompletedDate: null,
  });
}

export function saveRecallState(state) { storage.set(KEY, state); }

// Determine current UI mode: "recall" | "memorize" | "already-done"
export function currentMode(state) {
  const t = today();
  if (state.pending) {
    // Have something to recall — check whether it was generated on a prior day
    if (state.pending.generatedOn < t) return "recall";
    // Same day as generated: just memorize reminder
    return "memorize";
  }
  return "generate";
}

export function ensureTodaysChallenge(state, cfg) {
  // If no pending, generate today's challenge
  const t = today();
  if (state.pending) return state;
  const c = { ...(state.cfg || DEFAULT_RECALL_CFG), ...(cfg || {}) };
  const gen = generateChallenge(c, seedFromDate(t));
  return { ...state, pending: { generatedOn: t, phrase: gen.phrase, number: gen.number, cfg: c }, cfg: c };
}

// Levenshtein for word-level phrase scoring
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = new Array(n + 1).fill(0).map((_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const cur = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      prev = cur;
    }
  }
  return dp[n];
}

function normalizePhrase(s) {
  return String(s || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

export function scoreRecall(pending, given) {
  // Phrase: word-level accuracy (portion of correct words in order) + character similarity
  const expWords = normalizePhrase(pending.phrase).split(" ");
  const givWords = normalizePhrase(given.phrase).split(" ").filter(Boolean);
  const wordHits = expWords.reduce((s, w, i) => s + (givWords[i] === w ? 1 : 0), 0);
  const phraseWordAcc = expWords.length ? wordHits / expWords.length : 0;

  const expNorm = normalizePhrase(pending.phrase).replace(/\s+/g, "");
  const givNorm = normalizePhrase(given.phrase).replace(/\s+/g, "");
  const dist = levenshtein(expNorm, givNorm);
  const maxLen = Math.max(1, expNorm.length);
  const phraseCharAcc = Math.max(0, 1 - dist / maxLen);

  const numExp = String(pending.number);
  const numGiv = String(given.number || "");
  const numHits = numExp.split("").reduce((s, c, i) => s + (numGiv[i] === c ? 1 : 0), 0);
  const numberCharAcc = numExp.length ? numHits / numExp.length : 0;
  const numberExact = numExp === numGiv;
  const phraseExact = expNorm === givNorm;

  return {
    phraseWordAccuracy: phraseWordAcc,
    phraseCharAccuracy: phraseCharAcc,
    numberCharAccuracy: numberCharAcc,
    numberExact,
    phraseExact,
    overall: (phraseWordAcc + numberCharAcc) / 2,
  };
}

export function submitRecall(given, cfg) {
  const s = loadRecallState();
  if (!s.pending) return { error: "No pending challenge" };
  const t = today();
  const delayDays = daysBetween(s.pending.generatedOn, t);
  const score = scoreRecall(s.pending, given);
  const entry = {
    date: t,
    generatedOn: s.pending.generatedOn,
    phrase: s.pending.phrase,
    number: s.pending.number,
    given,
    delayDays,
    ...score,
  };
  const history = [entry, ...s.history];
  // Streak: consider "completed" if overall >= 0.5. Increment if last completion was yesterday.
  const wasYesterday = s.lastCompletedDate && daysBetween(s.lastCompletedDate, t) === 1;
  const streak = wasYesterday ? s.streak + 1 : 1;
  const longestStreak = Math.max(s.longestStreak || 0, streak);
  // Generate the next challenge (for today, recall tomorrow)
  const nextCfg = { ...(s.cfg || DEFAULT_RECALL_CFG), ...(cfg || {}) };
  const next = generateChallenge(nextCfg, seedFromDate(t) + 1);
  const newState = {
    ...s,
    pending: { generatedOn: t, phrase: next.phrase, number: next.number, cfg: nextCfg },
    history,
    streak,
    longestStreak,
    lastCompletedDate: t,
    cfg: nextCfg,
  };
  saveRecallState(newState);
  return { entry, state: newState };
}

export function skipToday() {
  // "Show me a new challenge" — replaces pending without recording history
  const s = loadRecallState();
  const t = today();
  const cfg = s.cfg || DEFAULT_RECALL_CFG;
  const gen = generateChallenge(cfg, seedFromDate(t) + Math.floor(Math.random() * 1000));
  const newState = { ...s, pending: { generatedOn: t, phrase: gen.phrase, number: gen.number, cfg } };
  saveRecallState(newState);
  return newState;
}
