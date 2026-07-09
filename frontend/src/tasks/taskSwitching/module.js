// Task Switching paradigm.
// A stimulus (letter + number, optionally colored) appears in one of 4 quadrants.
// Each quadrant is assigned a task type. The task determines which binary rule the user must apply.
// Metrics: switch cost = mean(RT | switch) - mean(RT | repeat).

// ---------------- Task type registry ----------------
// Every task type declares: id, label, applies ("letter"/"number"/"color"),
// classify(stimulus, params) -> "A" | "B", responseLabels(params) -> [labelA, labelB]

const isVowel = (l) => /[AEIOU]/.test(String(l).toUpperCase());
const CURVED_LETTERS = "BCDGJOPQRSU";
function isPrime(n) {
  n = Math.abs(Math.trunc(n));
  if (n < 2) return false;
  if (n < 4) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false;
  return true;
}

export const TS_TASK_TYPES = [
  {
    id: "letter-case", label: "Letter case", applies: "letter",
    labels: () => ["Uppercase", "Lowercase"],
    classify: (s) => (s.letter === String(s.letter).toUpperCase() ? "A" : "B"),
  },
  {
    id: "letter-vowel", label: "Vowel vs consonant", applies: "letter",
    labels: () => ["Vowel", "Consonant"],
    classify: (s) => (isVowel(s.letter) ? "A" : "B"),
  },
  {
    id: "letter-before-m", label: "Before / after M", applies: "letter",
    labels: () => ["Before M", "After M"],
    classify: (s) => (String(s.letter).toUpperCase() < "M" ? "A" : "B"),
  },
  {
    id: "letter-curved", label: "Curved vs straight", applies: "letter",
    labels: () => ["Curved", "Straight"],
    classify: (s) => (CURVED_LETTERS.includes(String(s.letter).toUpperCase()) ? "A" : "B"),
  },
  {
    id: "number-even", label: "Even vs odd", applies: "number",
    labels: () => ["Even", "Odd"],
    classify: (s) => (s.number % 2 === 0 ? "A" : "B"),
  },
  {
    id: "number-prime", label: "Prime vs composite", applies: "number",
    labels: () => ["Prime", "Composite"],
    classify: (s) => (isPrime(s.number) ? "A" : "B"),
  },
  {
    id: "number-gt", label: "Greater than N", applies: "number",
    params: { threshold: 5 },
    labels: (p) => [`> ${p.threshold}`, `≤ ${p.threshold}`],
    classify: (s, p) => (s.number > (p?.threshold ?? 5) ? "A" : "B"),
  },
  {
    id: "number-lt", label: "Less than N", applies: "number",
    params: { threshold: 5 },
    labels: (p) => [`< ${p.threshold}`, `≥ ${p.threshold}`],
    classify: (s, p) => (s.number < (p?.threshold ?? 5) ? "A" : "B"),
  },
  {
    id: "number-positive", label: "Positive vs negative", applies: "number",
    labels: () => ["Positive", "Negative"],
    classify: (s) => (s.number >= 0 ? "A" : "B"),
  },
  {
    id: "number-divisible", label: "Divisible by N", applies: "number",
    params: { divisor: 3 },
    labels: (p) => [`÷ ${p.divisor} = 0`, "not divisible"],
    classify: (s, p) => (s.number % (p?.divisor ?? 3) === 0 ? "A" : "B"),
  },
  {
    id: "color-match", label: "Font matches BG", applies: "color",
    labels: () => ["Same", "Different"],
    classify: (s) => (s.fontColor === s.bgColor ? "A" : "B"),
  },
];

export function getTaskType(id) {
  return TS_TASK_TYPES.find((t) => t.id === id);
}

// ---------------- Config ----------------
const DEFAULT_LETTERS = ["A","B","C","D","E","F","G","H","J","K","L","M","N","P","Q","R","S","T","U","V"];
const DEFAULT_COLORS  = ["#7aa2f7","#bb9af7","#9ece6a","#e0af68","#f7768e","#7dcfff"];

export const DEFAULT_TASK_SWITCHING = {
  taskId: "taskSwitching",
  quadrants: [
    { type: "letter-case",    params: {} },  // 0: top-left
    { type: "number-even",    params: {} },  // 1: top-right
    { type: "letter-vowel",   params: {} },  // 2: bottom-left
    { type: "number-prime",   params: {} },  // 3: bottom-right
  ],
  rounds: 30,
  stimulusMs: 1500,
  isiMs: 400,
  reactionWindowMs: 2500,
  switchProbability: 0.5,
  minNumber: 1,
  maxNumber: 9,
  allowNegatives: false,
  mixedCase: true,
  useColor: false,
  seed: null,
  practice: false,
  adaptive: false,
  letters: DEFAULT_LETTERS,
  colors: DEFAULT_COLORS,
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = (s) => (s == null ? Math.random : mulberry32(s));

function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

function randomStimulus(cfg, r) {
  let letter = pick(cfg.letters || DEFAULT_LETTERS, r);
  if (cfg.mixedCase && r() < 0.5) letter = String(letter).toLowerCase();
  let number = Math.floor(cfg.minNumber + r() * (cfg.maxNumber - cfg.minNumber + 1));
  if (cfg.allowNegatives && r() < 0.4) number = -number;
  const fontColor = cfg.useColor ? pick(cfg.colors || DEFAULT_COLORS, r) : null;
  const bgColor   = cfg.useColor ? pick(cfg.colors || DEFAULT_COLORS, r) : null;
  return { letter, number, fontColor, bgColor };
}

export function generateSequence(cfg) {
  const r = rng(cfg.seed);
  const trials = [];
  let prevQuadrant = null;
  for (let i = 0; i < cfg.rounds; i++) {
    let quadrant;
    if (prevQuadrant == null) {
      quadrant = Math.floor(r() * 4);
    } else {
      const switching = r() < cfg.switchProbability;
      if (switching) {
        // pick different quadrant
        do { quadrant = Math.floor(r() * 4); } while (quadrant === prevQuadrant);
      } else {
        quadrant = prevQuadrant;
      }
    }
    const stimulus = randomStimulus(cfg, r);
    const q = cfg.quadrants[quadrant];
    const type = getTaskType(q.type);
    // If stimulus doesn't apply to this rule, regenerate up to 3 tries
    let s = stimulus;
    if (type?.applies === "color" && !cfg.useColor) {
      // must have colors — enable if user picked a color rule
    }
    const expected = type ? type.classify(s, q.params) : "A";
    trials.push({
      index: i,
      quadrant,
      rule: q.type,
      params: q.params,
      stimulus: s,
      expected,
      isSwitch: prevQuadrant != null && quadrant !== prevQuadrant,
    });
    prevQuadrant = quadrant;
  }
  return trials;
}

const taskSwitching = {
  id: "taskSwitching",
  name: "Task Switching",
  short: "Cognitive flexibility · switch cost",
  color: "hsl(var(--chart-5))",
  defaults: DEFAULT_TASK_SWITCHING,
  describeConfig(cfg) {
    const rules = (cfg?.quadrants || []).map((q) => getTaskType(q.type)?.label || "?");
    const unique = Array.from(new Set(rules));
    return `${cfg?.rounds ?? "?"} trials · ${unique.length} rules · switch p=${((cfg?.switchProbability ?? 0.5) * 100).toFixed(0)}%`;
  },
  summarizeKPI(session) {
    return [
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "Switch Cost", value: session.summary?.switchCostMs, unit: "ms" },
      { label: "Mean RT", value: session.summary?.rt?.mean, unit: "ms" },
      { label: "Rounds", value: session.config.rounds },
    ];
  },
};

export default taskSwitching;
