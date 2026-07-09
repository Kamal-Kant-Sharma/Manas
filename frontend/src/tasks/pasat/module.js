// PASAT — Paced Auditory Serial Addition Test.
// Each trial: a number is presented (audio + visual). User adds it to the PREVIOUS number.
// Also supports subtraction/multiplication/etc. and alternating/random operations.

export const PASAT_OPS = [
  { key: "add", label: "Add",       fn: (a, b) => a + b, symbol: "+" },
  { key: "sub", label: "Subtract",  fn: (a, b) => a - b, symbol: "−" },
  { key: "mul", label: "Multiply",  fn: (a, b) => a * b, symbol: "×" },
  { key: "div", label: "Divide",    fn: (a, b) => b === 0 ? 0 : a / b, symbol: "÷" },
  { key: "mod", label: "Modulo",    fn: (a, b) => b === 0 ? 0 : a % b, symbol: "%" },
  { key: "avg", label: "Average",   fn: (a, b) => (a + b) / 2, symbol: "μ" },
];

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
  operations: ["add"],    // list of ops used
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
  // Compute expected answer sequence (trial i >= 1: op(numbers[i-1], numbers[i]))
  const expected = numbers.map((n, i) => {
    if (i === 0) return null;
    const opKey = opsPerTrial[i];
    const op = PASAT_OPS.find((o) => o.key === opKey) || PASAT_OPS[0];
    const val = op.fn(numbers[i - 1], numbers[i]);
    return cfg.decimals ? +val.toFixed(2) : Math.round(val);
  });
  return { numbers, ops: opsPerTrial, expected };
}

const pasat = {
  id: "pasat",
  name: "PASAT",
  short: "Paced serial addition · attention & speed",
  color: "hsl(var(--chart-4))",
  defaults: DEFAULT_PASAT,
  describeConfig(cfg) {
    const opsLabel = cfg.operationMode === "single" ? PASAT_OPS.find((o) => o.key === cfg.operations[0])?.label
      : `${cfg.operationMode} (${cfg.operations.length})`;
    return `${cfg.rounds} trials · ${cfg.intervalMs}ms · ${opsLabel}`;
  },
  summarizeKPI(session) {
    return [
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "Correct", value: session.summary?.correct, unit: "" },
      { label: "Mean RT", value: session.summary?.rt?.mean, unit: "ms" },
      { label: "Rounds", value: session.config.rounds },
    ];
  },
};

export default pasat;
