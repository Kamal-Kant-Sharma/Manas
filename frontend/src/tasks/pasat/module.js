// PASAT — Paced Auditory Serial Addition Test with configurable rolling window.
// Each trial: a number is presented. User applies the operation across the last `windowSize` numbers.
// window=2 → classic PASAT (op previous, current); window=3 → op previous 2, current; etc.

function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a; }
function lcm(a, b) { if (a === 0 || b === 0) return 0; return Math.abs(a * b) / gcd(a, b); }

export const PASAT_OPS = [
  { key: "add", label: "Add",       fn: (a, b) => a + b,                    symbol: "+" },
  { key: "sub", label: "Subtract",  fn: (a, b) => a - b,                    symbol: "−" },
  { key: "mul", label: "Multiply",  fn: (a, b) => a * b,                    symbol: "×" },
  { key: "div", label: "Divide",    fn: (a, b) => b === 0 ? 0 : a / b,      symbol: "÷" },
  { key: "mod", label: "Modulo",    fn: (a, b) => b === 0 ? 0 : a % b,      symbol: "%" },
  { key: "avg", label: "Average",   fn: (a, b) => (a + b) / 2,              symbol: "μ" },
  { key: "gcd", label: "GCD",       fn: (a, b) => gcd(a, b),                symbol: "∧" },
  { key: "lcm", label: "LCM",       fn: (a, b) => lcm(a, b),                symbol: "∨" },
];

// Reduce a window of numbers using an op. For non-associative ops (sub/div/mod) this is left-fold.
function reduceWindow(nums, opKey) {
  const op = PASAT_OPS.find((o) => o.key === opKey) || PASAT_OPS[0];
  if (opKey === "avg") {
    // avg over the entire window (not pairwise avg)
    const sum = nums.reduce((s, x) => s + x, 0);
    return sum / nums.length;
  }
  return nums.reduce((acc, x, i) => (i === 0 ? x : op.fn(acc, x)));
}

export const DEFAULT_PASAT = {
  taskId: "pasat",
  rounds: 30,
  intervalMs: 2400,       // time between number presentations
  reactionWindowMs: 2400, // deadline for answer
  audio: true,
  visual: true,
  minNumber: 1,
  maxNumber: 9,
  allowNegatives: false,
  decimals: false,
  windowSize: 2,          // NEW: how many recent numbers are combined
  operations: ["add"],
  operationMode: "single", // single | alternating | random
  adaptive: false,
  seed: null,
};

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rng(seed) { return seed == null ? Math.random : mulberry32(seed); }

export function generatePASAT(cfg) {
  const r = rng(cfg.seed);
  const ops = cfg.operations.length ? cfg.operations : ["add"];
  const W = Math.max(2, cfg.windowSize || 2);
  const numbers = [];
  const opsPerTrial = [];
  for (let i = 0; i < cfg.rounds; i++) {
    let n;
    if (cfg.decimals) {
      n = +(cfg.minNumber + r() * (cfg.maxNumber - cfg.minNumber)).toFixed(1);
    } else {
      n = Math.floor(cfg.minNumber + r() * (cfg.maxNumber - cfg.minNumber + 1));
    }
    if (cfg.allowNegatives && r() < 0.4) n = -n;
    numbers.push(n);
    let op;
    if (cfg.operationMode === "single") op = ops[0];
    else if (cfg.operationMode === "alternating") op = ops[i % ops.length];
    else op = ops[Math.floor(r() * ops.length)];
    opsPerTrial.push(op);
  }
  // Expected answer at index i is defined for i >= W-1: op-reduce(numbers[i-W+1..i]).
  const expected = numbers.map((n, i) => {
    if (i < W - 1) return null;
    const opKey = opsPerTrial[i];
    const window = numbers.slice(i - W + 1, i + 1);
    const val = reduceWindow(window, opKey);
    if (cfg.decimals) return +val.toFixed(2);
    // For div use rounding, for others int
    return Math.round(val);
  });
  return { numbers, ops: opsPerTrial, expected, windowSize: W };
}

const pasat = {
  id: "pasat",
  name: "PASAT",
  short: "Paced serial addition · attention & speed",
  color: "hsl(var(--chart-4))",
  defaults: DEFAULT_PASAT,
  describeConfig(cfg) {
    const ops = cfg?.operations || [];
    const mode = cfg?.operationMode || "single";
    const opsLabel = mode === "single"
      ? (PASAT_OPS.find((o) => o.key === ops[0])?.label || "—")
      : `${mode} (${ops.length})`;
    const W = cfg?.windowSize ?? 2;
    return `${cfg?.rounds ?? "?"} trials · window ${W} · ${cfg?.intervalMs ?? "?"}ms · ${opsLabel}`;
  },
  summarizeKPI(session) {
    return [
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "Correct", value: session.summary?.correct, unit: "" },
      { label: "Mean RT", value: session.summary?.rt?.mean, unit: "ms" },
      { label: "Window", value: session.config?.windowSize ?? 2 },
    ];
  },
};

export default pasat;
