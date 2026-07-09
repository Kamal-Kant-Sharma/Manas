// Generic statistics engine — reused across all cognitive tasks.
// Input: array of trial responses annotated with { isTarget, responded, rtMs }.
// Output: accuracy, precision, recall, F1, RT stats, per-stream metrics.

export function classify(trial) {
  // isTarget: this trial was a true target (matches N steps back / correct answer)
  // responded: user pressed the response key within the reaction window
  const { isTarget, responded } = trial;
  if (isTarget && responded) return "TP";
  if (!isTarget && responded) return "FP";
  if (isTarget && !responded) return "FN";
  return "TN";
}

export function confusionMatrix(trials) {
  const cm = { TP: 0, FP: 0, FN: 0, TN: 0 };
  for (const t of trials) cm[classify(t)]++;
  return cm;
}

export function derivedMetrics(cm) {
  const { TP, FP, FN, TN } = cm;
  const total = TP + FP + FN + TN;
  const accuracy = total ? (TP + TN) / total : 0;
  const precision = TP + FP ? TP / (TP + FP) : 0;
  const recall = TP + FN ? TP / (TP + FN) : 0; // sensitivity
  const specificity = TN + FP ? TN / (TN + FP) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { accuracy, precision, recall, specificity, f1 };
}

export function rtStats(trials) {
  const rts = trials
    .filter((t) => t.responded && Number.isFinite(t.rtMs))
    .map((t) => t.rtMs)
    .sort((a, b) => a - b);
  if (!rts.length) {
    return { count: 0, mean: null, median: null, min: null, max: null, stdev: null, p25: null, p75: null };
  }
  const sum = rts.reduce((a, b) => a + b, 0);
  const mean = sum / rts.length;
  const variance = rts.reduce((s, x) => s + (x - mean) ** 2, 0) / rts.length;
  return {
    count: rts.length,
    mean,
    median: rts[Math.floor(rts.length / 2)],
    min: rts[0],
    max: rts[rts.length - 1],
    stdev: Math.sqrt(variance),
    p25: rts[Math.floor(rts.length * 0.25)],
    p75: rts[Math.floor(rts.length * 0.75)],
  };
}

export function streaks(trials) {
  // Longest correct streak (TP or TN counts as correct) and longest mistake streak.
  let bestCorrect = 0, bestMistake = 0, curC = 0, curM = 0;
  for (const t of trials) {
    const kind = classify(t);
    const correct = kind === "TP" || kind === "TN";
    if (correct) { curC++; curM = 0; bestCorrect = Math.max(bestCorrect, curC); }
    else { curM++; curC = 0; bestMistake = Math.max(bestMistake, curM); }
  }
  return { longestCorrect: bestCorrect, longestMistake: bestMistake };
}

// Compute per-stream metrics given trials with `perStream: { [streamKey]: {isTarget, responded, rtMs} }`
export function perStreamSummary(trials, streamKeys) {
  const out = {};
  for (const k of streamKeys) {
    const streamTrials = trials.map((t) => t.perStream?.[k]).filter(Boolean);
    const cm = confusionMatrix(streamTrials);
    out[k] = {
      confusion: cm,
      metrics: derivedMetrics(cm),
      rt: rtStats(streamTrials),
    };
  }
  return out;
}

export function rollingAverage(values, window = 5) {
  const out = [];
  for (let i = 0; i < values.length; i++) {
    const s = Math.max(0, i - window + 1);
    const slice = values.slice(s, i + 1);
    out.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return out;
}

export function summarizeSession(trials, extras = {}) {
  const cm = confusionMatrix(trials);
  return {
    confusion: cm,
    metrics: derivedMetrics(cm),
    rt: rtStats(trials),
    streaks: streaks(trials),
    totalTrials: trials.length,
    ...extras,
  };
}
