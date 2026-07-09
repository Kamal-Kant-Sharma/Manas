// N-Back task module: config, defaults, engine (stimulus generator), summary meta.

export const NBACK_STREAMS = [
  { key: "position", label: "Position", type: "visual",   icon: "grid",     hotkey: "a" },
  { key: "color",    label: "Color",    type: "visual",   icon: "palette",  hotkey: "s" },
  { key: "number",   label: "Number",   type: "visual",   icon: "hash",     hotkey: "d" },
  { key: "letter",   label: "Letter",   type: "visual",   icon: "type",     hotkey: "f" },
  { key: "shape",    label: "Shape",    type: "visual",   icon: "shapes",   hotkey: "g" },
  { key: "symbol",   label: "Symbol",   type: "visual",   icon: "asterisk", hotkey: "h" },
  { key: "audioLetter", label: "Audio Letter", type: "audio", icon: "volume-2", hotkey: "l" },
  { key: "audioNumber", label: "Audio Number", type: "audio", icon: "volume-2", hotkey: ";" },
];

const LETTERS = ["B","C","D","F","G","H","J","K","L","M","N","P","Q","R","S","T","V","W","X","Z"];
const SHAPES  = ["circle","square","triangle","diamond","hex","star","plus","cross"];
const SYMBOLS = ["◈","◆","▲","●","■","✚","✱","✦"];
const COLORS  = ["#7aa2f7","#bb9af7","#9ece6a","#e0af68","#f7768e","#7dcfff","#ff9e64","#c0caf5"];

export const NBACK_ALPHABETS = { LETTERS, SHAPES, SYMBOLS, COLORS };

export const DEFAULT_NBACK = {
  taskId: "nback",
  n: 2,
  gridSize: 3,                 // 3..9
  streams: { position: true, audioLetter: true }, // dual N-back default
  stimulusMs: 500,
  isiMs: 2000,                 // inter-stimulus interval (start-to-start = stim + isi)
  reactionWindowMs: 2200,      // window after stimulus onset
  rounds: 20 + 2,              // total trials (includes warmup n)
  warmup: 2,                   // first N trials don't count for scoring
  targetProbability: 0.28,
  adaptive: false,
  practice: false,
  seed: null,
  colors: COLORS,
  letters: LETTERS,
  shapes: SHAPES,
  symbols: SYMBOLS,
  audioVoice: null,
  audioRate: 1,
  audioPitch: 1,
  audioVolume: 1,
};

// Mulberry32 PRNG for reproducibility
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function rng(seed) { return seed == null ? Math.random : mulberry32(seed); }

// Alphabet resolver per stream
export function alphabetFor(streamKey, cfg) {
  switch (streamKey) {
    case "position": return Array.from({ length: cfg.gridSize * cfg.gridSize }, (_, i) => i);
    case "color":    return cfg.colors || COLORS;
    case "number":   return [1,2,3,4,5,6,7,8,9];
    case "letter":   return cfg.letters || LETTERS;
    case "shape":    return cfg.shapes || SHAPES;
    case "symbol":   return cfg.symbols || SYMBOLS;
    case "audioLetter": return cfg.letters || LETTERS;
    case "audioNumber": return [1,2,3,4,5,6,7,8,9];
    default: return [];
  }
}

// Generate a full sequence of trials for the session.
// Each trial is: { index, stimuli: { [streamKey]: value }, targets: { [streamKey]: bool } }
export function generateSequence(cfg) {
  const r = rng(cfg.seed);
  const N = cfg.n;
  const total = cfg.rounds;
  const activeStreams = Object.keys(cfg.streams).filter((k) => cfg.streams[k]);
  const seqPerStream = {};
  for (const k of activeStreams) seqPerStream[k] = [];

  const trials = [];
  for (let i = 0; i < total; i++) {
    const stimuli = {};
    const targets = {};
    for (const k of activeStreams) {
      const alpha = alphabetFor(k, cfg);
      let val;
      let isTarget = false;
      if (i >= N && r() < cfg.targetProbability) {
        // Force target: repeat value from n steps back
        val = seqPerStream[k][i - N];
        isTarget = true;
      } else {
        // Pick a non-target when possible
        val = alpha[Math.floor(r() * alpha.length)];
        if (i >= N && val === seqPerStream[k][i - N]) {
          // accidental match — swap to another value if we can
          const other = alpha.find((x) => x !== seqPerStream[k][i - N]);
          if (other !== undefined) val = other;
          isTarget = false;
        }
      }
      seqPerStream[k].push(val);
      stimuli[k] = val;
      targets[k] = i >= N && isTarget;
    }
    trials.push({ index: i, stimuli, targets, isWarmup: i < N + (cfg.warmup || 0) });
  }
  return { trials, activeStreams };
}

const nback = {
  id: "nback",
  name: "N-Back",
  short: "Working memory · multi-stream",
  color: "hsl(var(--chart-1))",
  defaults: DEFAULT_NBACK,
  describeConfig(cfg) {
    const streams = cfg?.streams || {};
    const active = Object.keys(streams).filter((k) => streams[k]);
    const streamName = active.length === 1 ? "Single" : active.length === 2 ? "Dual" : active.length === 3 ? "Triple" : `${active.length}x`;
    return `${streamName} ${cfg?.n ?? "?"}-back · ${active.map((k) => NBACK_STREAMS.find((s) => s.key === k)?.label).join(" + ") || "—"} · ${cfg?.rounds ?? "?"} trials`;
  },
  summarizeKPI(session) {
    return [
      { label: "N", value: session.config.n },
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "F1", value: session.summary?.metrics?.f1 },
      { label: "Mean RT", value: session.summary?.rt?.mean, unit: "ms" },
    ];
  },
};

export default nback;
