// Operation Span (OSPAN) working memory task.
// Alternates: memorize item -> solve distractor -> memorize item -> distractor -> ... -> recall sequence.

const LETTERS = ["B","C","D","F","G","H","J","K","L","M","N","P","Q","R","S","T","V","W","X","Z"];
const WORDS   = ["north","light","piano","zero","cloud","atlas","forge","noble","axis","glimpse","raven","yield","mirror","harbor"];
const COLORS  = ["#7aa2f7","#bb9af7","#9ece6a","#e0af68","#f7768e","#7dcfff","#ff9e64"];
const SHAPES  = ["circle","square","triangle","diamond","hex","star"];
const SYMBOLS = ["◈","◆","▲","●","■","✚","✱","✦"];

export const OSPAN_ITEMS = { LETTERS, WORDS, COLORS, SHAPES, SYMBOLS };

// ---- Distractor registry ----
// Each distractor generates a { prompt, expected, choices } challenge.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = seed; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rng = (s) => (s == null ? Math.random : mulberry32(s));

function arithmeticDistractor(cfg, r) {
  const ops = ["+", "-", "×", "÷"];
  const op = ops[Math.floor(r() * (cfg.arithmeticDifficulty === "easy" ? 2 : ops.length))];
  const max = cfg.arithmeticDifficulty === "easy" ? 12 : cfg.arithmeticDifficulty === "medium" ? 20 : 40;
  let a = Math.floor(r() * max) + 1;
  let b = Math.floor(r() * max) + 1;
  let expected;
  switch (op) {
    case "+": expected = a + b; break;
    case "-": if (a < b) [a, b] = [b, a]; expected = a - b; break;
    case "×": a = Math.min(a, 12); b = Math.min(b, 12); expected = a * b; break;
    case "÷": expected = a; a = a * b; break; // a/b = expected, guaranteed clean division
    default: expected = a + b;
  }
  // Present a candidate answer that's either correct or off by ±small amount
  const isCorrect = r() < 0.5;
  const candidate = isCorrect ? expected : expected + (r() < 0.5 ? -1 : 1) * (Math.floor(r() * 3) + 1);
  return {
    kind: "arithmetic",
    prompt: `${a} ${op} ${b} = ${candidate}`,
    expected: isCorrect ? "yes" : "no",
    choices: [
      { key: "yes", label: "True" },
      { key: "no", label: "False" },
    ],
  };
}

function spatialDistractor(cfg, r) {
  // Two 2x2 patterns of filled/unfilled cells. Second is either same, mirrored horizontally, or rotated 180.
  const pattern = Array.from({ length: 4 }, () => r() < 0.5 ? 1 : 0);
  const transforms = [
    { kind: "same",    fn: (p) => p },
    { kind: "mirror",  fn: (p) => [p[1], p[0], p[3], p[2]] }, // horizontal flip
    { kind: "rot180",  fn: (p) => [p[3], p[2], p[1], p[0]] },
  ];
  const t = transforms[Math.floor(r() * transforms.length)];
  return {
    kind: "spatial",
    prompt: "Compare the two patterns",
    left: pattern,
    right: t.fn(pattern),
    expected: t.kind === "same" ? "same" : "different",
    choices: [
      { key: "same", label: "Same" },
      { key: "different", label: "Different" },
    ],
  };
}

export function generateDistractor(cfg, r) {
  const types = cfg.distractorTypes && cfg.distractorTypes.length ? cfg.distractorTypes : ["arithmetic"];
  const type = types[Math.floor(r() * types.length)];
  switch (type) {
    case "spatial":    return spatialDistractor(cfg, r);
    case "arithmetic":
    default:           return arithmeticDistractor(cfg, r);
  }
}

// ---- Item pool ----
export function alphabetForItem(kind) {
  switch (kind) {
    case "letters": return LETTERS;
    case "numbers": return [0,1,2,3,4,5,6,7,8,9];
    case "words":   return WORDS;
    case "colors":  return COLORS;
    case "shapes":  return SHAPES;
    case "symbols": return SYMBOLS;
    case "mixed":   return [...LETTERS.slice(0, 10), ...WORDS.slice(0, 6)];
    default:        return LETTERS;
  }
}

export function generateItem(cfg, r) {
  const alpha = alphabetForItem(cfg.itemType);
  return alpha[Math.floor(r() * alpha.length)];
}

export function expectedRecall(sequence, recall) {
  const s = [...sequence];
  switch (recall) {
    case "forward":      return s;
    case "backward":     return s.reverse();
    case "ascending":    return [...s].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0));
    case "descending":   return [...s].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    case "alphabetical": return [...s].sort((a, b) => String(a).localeCompare(String(b)));
    case "random":       // random order = any permutation is accepted (evaluated as set match)
      return s;
    default:             return s;
  }
}

export const DEFAULT_OSPAN = {
  taskId: "ospan",
  itemType: "letters",              // letters | numbers | words | colors | shapes | symbols | mixed
  recall: "forward",
  startLength: 3,
  maxLength: 8,
  adaptive: true,
  trialsPerLength: 1,               // failures before we stop
  presentationMs: 900,
  distractorMs: 4000,               // max time to solve the distractor
  gapMs: 300,
  distractorTypes: ["arithmetic"],  // arithmetic | spatial
  arithmeticDifficulty: "medium",   // easy | medium | hard
  practice: false,
  seed: null,
};

const ospan = {
  id: "ospan",
  name: "Operation Span",
  short: "Working memory · memorize + distractor + recall",
  color: "hsl(var(--chart-6))",
  defaults: DEFAULT_OSPAN,
  howToPlay: [
    "A short item (letter, number, color, word, shape or symbol) is shown for you to memorize.",
    "Immediately after, a distractor task appears — either a mental arithmetic problem to verify (True/False) or two spatial patterns to compare (Same/Different).",
    "This alternation repeats for the current sequence length. When the last distractor finishes, type back ALL memorized items in the requested recall order.",
    "You must both remember the sequence AND solve distractors quickly. Sequence length increases on success; stops after the allowed failures.",
  ],
  keybinds: [
    { key: "Click", action: "Answer distractor (True / False or Same / Different)" },
    { key: "Type", action: "Recall the sequence" },
    { key: "Enter", action: "Submit recall" },
  ],
  domainContributions: {
    workingMemory:     1.0,
    executiveFunction: 0.7,
    attention:         0.5,
    mentalArithmetic:  0.4,
    shortTermMemory:   0.4,
  },
  describeConfig(cfg) {
    return `${cfg?.itemType ?? "letters"} · ${cfg?.recall ?? "forward"} · ${cfg?.distractorTypes?.join("+")} · from ${cfg?.startLength ?? 3}`;
  },
  summarizeKPI(session) {
    return [
      { label: "Max Span", value: session.summary?.maxSpan },
      { label: "Combined", value: session.summary?.combinedScore },
      { label: "Memory Acc", value: session.summary?.memoryAccuracy },
      { label: "Distractor Acc", value: session.summary?.distractorAccuracy },
    ];
  },
};

export default ospan;

// Utility rng exposed so Runner can reuse the same seed sequence
export function makeRng(seed) { return rng(seed); }
