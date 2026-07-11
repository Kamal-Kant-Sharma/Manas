// Corsi Block-Tapping Test.
// Each trial: generate `length` fresh blocks at non-overlapping positions.
// Blocks light up one after another (in creation order). User then taps
// them in the required order (forward = same order, backward = reversed).
// Each tap removes the block from the board — this cleanly handles what
// would otherwise be double-tap ambiguity in a fixed-layout Corsi.

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = (s) => (s == null ? Math.random : mulberry32(s));

// Board is treated as a 100×100 percentage grid; block positions are in %.
export function blockSizeFor(length) {
  if (length <= 5)  return 72;
  if (length <= 8)  return 62;
  if (length <= 11) return 54;
  return 46;
}

// Generate `length` block positions that don't overlap.
// blockSize is in pixels; boardSize is the container size in pixels.
export function generateBlocks(length, r, boardSize = 480) {
  const blockPx = blockSizeFor(length);
  const marginPct = (blockPx / boardSize) * 50; // half block in %
  const minSepPct = (blockPx / boardSize) * 100 + 3; // block width + a hair
  const positions = [];
  let attempts = 0;
  while (positions.length < length && attempts < 5000) {
    attempts++;
    const p = {
      x: marginPct + r() * (100 - 2 * marginPct),
      y: marginPct + r() * (100 - 2 * marginPct),
    };
    const ok = positions.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minSepPct);
    if (ok) positions.push(p);
  }
  // Fallback: if we still don't have enough (crowded board), relax and place on a grid
  if (positions.length < length) {
    positions.length = 0;
    const cols = Math.ceil(Math.sqrt(length));
    const rows = Math.ceil(length / cols);
    for (let i = 0; i < length; i++) {
      const c = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        x: (100 / (cols + 1)) * (c + 1),
        y: (100 / (rows + 1)) * (row + 1),
      });
    }
  }
  // Each block gets an id = its index (which is also its position in the sequence)
  return positions.map((p, i) => ({ id: i, ...p, blockPx }));
}

// Expected tap order given a sequence-of-block-ids and recall mode.
export function expectedOrder(blockIds, recall) {
  return recall === "backward" ? [...blockIds].reverse() : [...blockIds];
}

export const DEFAULT_CORSI = {
  taskId: "corsi",
  startLength: 3,
  maxLength: 12,
  adaptive: true,
  trialsPerLength: 2,          // failures allowed per length
  recall: "forward",           // forward | backward
  presentationMs: 700,
  gapMs: 300,
  recallTimeoutMs: 20000,
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
    "Each round, a fresh set of blocks appears at new positions on the board.",
    "The blocks light up one after another — remember the order in which they light up.",
    "When it's your turn, tap the blocks in the same order for forward recall, or in reverse order for backward recall.",
    "Each block disappears as soon as you tap it. Sequence length grows on success and the session ends after the configured number of failures at one length.",
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
    return `${cfg?.recall ?? "forward"} · from ${cfg?.startLength ?? 3} up to ${cfg?.maxLength ?? 12}`;
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
