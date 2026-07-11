// Memory Span task. Present a sequence, user recalls it.

const LETTERS = ["B","C","D","F","G","H","J","K","L","M","N","P","Q","R","S","T","V","W","X","Z"];
const WORDS = ["north","light","piano","zero","cloud","atlas","forge","noble","axis","glimpse","raven","yield"];
const COLORS = ["#7aa2f7","#bb9af7","#9ece6a","#e0af68","#f7768e","#7dcfff","#ff9e64","#c0caf5"];
const SHAPES = ["circle","square","triangle","diamond","hex","star","plus","cross"];

export const MEMORY_STIMULI = { LETTERS, WORDS, COLORS, SHAPES };

export const DEFAULT_MEMORY_SPAN = {
  taskId: "memorySpan",
  stimulus: "digits",            // digits | letters | words | colors | shapes | positions | audio-letters | audio-digits
  recall: "forward",             // forward | backward | ascending | descending | alphabetical
  startLength: 3,
  maxLength: 12,
  adaptive: true,
  presentationMs: 800,
  gapMs: 300,
  trialsPerLength: 2,            // if adaptive: allow 2 attempts before finishing
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
const rng = (seed) => (seed == null ? Math.random : mulberry32(seed));

export function alphabetForMemory(stim) {
  switch (stim) {
    case "digits":         return [0,1,2,3,4,5,6,7,8,9];
    case "letters":
    case "audio-letters":  return LETTERS;
    case "words":          return WORDS;
    case "colors":         return COLORS;
    case "shapes":         return SHAPES;
    case "positions":      return Array.from({ length: 9 }, (_, i) => i); // 3x3 grid
    case "audio-digits":   return [0,1,2,3,4,5,6,7,8,9];
    default:               return [0,1,2,3,4,5,6,7,8,9];
  }
}

export function generateSequence(length, cfg) {
  const r = rng(cfg.seed);
  const alpha = alphabetForMemory(cfg.stimulus);
  const out = [];
  for (let i = 0; i < length; i++) out.push(alpha[Math.floor(r() * alpha.length)]);
  return out;
}

export function expectedAnswer(sequence, recall) {
  const s = [...sequence];
  switch (recall) {
    case "forward":      return s;
    case "backward":     return s.reverse();
    case "ascending":    return [...s].sort((a, b) => a > b ? 1 : a < b ? -1 : 0);
    case "descending":   return [...s].sort((a, b) => a < b ? 1 : a > b ? -1 : 0);
    case "alphabetical": return [...s].sort((a, b) => String(a).localeCompare(String(b)));
    default:             return s;
  }
}

const memorySpan = {
  id: "memorySpan",
  name: "Memory Span",
  short: "Sequence recall · working memory capacity",
  color: "hsl(var(--chart-2))",
  defaults: DEFAULT_MEMORY_SPAN,
  howToPlay: [
    "A sequence of items (digits, letters, positions, colors, words, shapes, or audio) is presented one at a time.",
    "After the sequence ends, type it back in the requested order (forward, backward, ascending, descending, or alphabetical).",
    "Separate items with spaces or commas — digits and single letters can be concatenated (e.g., '4172' or 'KMPB').",
    "Sequence length grows every time you succeed and stops after the configured number of failures at one length.",
  ],
  keybinds: [
    { key: "Type", action: "Enter recall sequence" },
    { key: "Enter", action: "Submit" },
  ],
  domainContributions: {
    shortTermMemory: 1.0,
    workingMemory:   0.7,
    attention:       0.4,
  },
  describeConfig(cfg) {
    return `${cfg?.stimulus ?? "?"} · ${cfg?.recall ?? "?"} · from ${cfg?.startLength ?? "?"}`;
  },
  summarizeKPI(session) {
    return [
      { label: "Max Span", value: session.summary?.maxSpan },
      { label: "Accuracy", value: session.summary?.metrics?.accuracy },
      { label: "Attempts", value: session.summary?.totalTrials },
      { label: "Errors", value: session.summary?.orderErrors },
    ];
  },
};

export default memorySpan;
