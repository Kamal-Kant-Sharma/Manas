// Corsi Block-Tapping Test.
// A set of blocks is shown. A sequence lights up. User taps blocks in order.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = (s) => (s == null ? Math.random : mulberry32(s));

// Classic Corsi 9-block scattered layout (percentages inside a container).
export const CLASSIC_LAYOUT_9 = [
  { x: 18, y: 22 }, { x: 62, y: 15 }, { x: 88, y: 34 },
  { x: 45, y: 40 }, { x: 12, y: 55 }, { x: 78, y: 58 },
  { x: 30, y: 78 }, { x: 55, y: 85 }, { x: 88, y: 82 },
];

export function generateLayout(cfg, r) {
  const N = cfg.blocks;
  const kind = cfg.layout;
  if (kind === "classic" && N === 9) return CLASSIC_LAYOUT_9;
  if (kind === "grid") {
    const cols = Math.ceil(Math.sqrt(N));
    const rows = Math.ceil(N / cols);
    const out = [];
    for (let i = 0; i < N; i++) {
      const c = i % cols, row = Math.floor(i / cols);
      out.push({ x: (100 / (cols + 1)) * (c + 1), y: (100 / (rows + 1)) * (row + 1) });
    }
    return out;
  }
  // random: reject overlapping positions (min 22% separation)
  const out = [];
  const MIN = 20;
  let attempts = 0;
  while (out.length < N && attempts < 500) {
    attempts++;
    const p = { x: 10 + r() * 80, y: 10 + r() * 80 };
    const ok = out.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= MIN);
    if (ok) out.push(p);
  }
  return out;
}

// Build a random sequence of length L from blocks 0..N-1, no immediate repeats.
export function generateSequence(N, L, r) {
  const seq = [];
  while (seq.length < L) {
    const idx = Math.floor(r() * N);
    if (seq.length && seq[seq.length - 1] === idx) continue;
    seq.push(idx);
  }
  return seq;
}

export const DEFAULT_CORSI = {
  taskId: "corsi",
  blocks: 9,
  layout: "classic",           // classic | grid | random
  startLength: 3,
  maxLength: 12,
  adaptive: true,
  trialsPerLength: 2,          // fails allowed per length
  recall: "forward",           // forward | backward
  presentationMs: 700,
  gapMs: 300,
  recallTimeoutMs: 15000,
  seed: null,
  practice: false,
};

const corsi = {
  id: "corsi",
  name: "Corsi Blocks",
  short: "Spatial working memory · tap the sequence",
  color: "hsl(var(--chart-7))",
  defaults: DEFAULT_CORSI,
  howToPlay: [
    "A set of blocks is shown at fixed positions on the board (9 by default, arranged in the classic Corsi scatter).",
    "The blocks light up one at a time in a sequence — watch carefully and remember the order.",
    "After the sequence ends, tap (or click) the blocks in the same order for forward recall, or reverse order for backward recall.",
    "Sequence length grows on success and stops after the configured number of failures at one length. Your maximum span is the highest length you got right.",
  ],
  keybinds: [
    { key: "Click", action: "Tap a block during recall" },
    { key: "Esc", action: "Exit session" },
  ],
  domainContributions: {
    spatialMemory:   1.0,
    workingMemory:   0.8,
    shortTermMemory: 0.5,
    attention:       0.4,
  },
  describeConfig(cfg) {
    return `${cfg?.blocks ?? 9} blocks · ${cfg?.layout ?? "classic"} · ${cfg?.recall ?? "forward"} · from ${cfg?.startLength ?? 3}`;
  },
  summarizeKPI(session) {
    return [
      { label: "Max Span", value: session.summary?.maxSpan },
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "Attempts", value: session.summary?.totalTrials },
      { label: "Order Errors", value: session.summary?.orderErrors },
    ];
  },
};

export default corsi;
export { rng as makeRng };
