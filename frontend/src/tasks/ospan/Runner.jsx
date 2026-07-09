import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { generateDistractor, generateItem, expectedRecall, makeRng } from "./module";
import { beep } from "../../lib/audio";
import { useApp } from "../../lib/store";

export default function OSPANRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const rngRef = useRef(makeRng(config.seed));
  const [length, setLength] = useState(config.startLength);
  const [phase, setPhase] = useState("countdown"); // countdown | present | distractor | recall | feedback | finished
  const [countdown, setCountdown] = useState(3);
  const [itemIdx, setItemIdx] = useState(0);         // index inside current trial (0..length-1)
  const [sequenceRef] = useState({ current: [] });   // items shown this trial
  const [currentItem, setCurrentItem] = useState(null);
  const [currentDistractor, setCurrentDistractor] = useState(null);
  const [distractorAnswer, setDistractorAnswer] = useState(null);
  const [recallInput, setRecallInput] = useState("");
  const [failuresAtLength, setFailuresAtLength] = useState(0);
  const attemptsRef = useRef([]);   // {length, items, expected, given, memoryCorrect, distractorHits, distractorTotal, rtMs}
  const distractorHitsRef = useRef(0);
  const distractorTotalRef = useRef(0);
  const startRef = useRef(0);
  const timerRef = useRef(null);

  const startTrial = useCallback(() => {
    sequenceRef.current = [];
    distractorHitsRef.current = 0;
    distractorTotalRef.current = 0;
    setItemIdx(0);
    setPhase("present");
  }, [sequenceRef]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startTrial(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, startTrial]);

  // Present item phase
  useEffect(() => {
    if (phase !== "present") return;
    const item = generateItem(config, rngRef.current);
    sequenceRef.current.push(item);
    setCurrentItem(item);
    timerRef.current = setTimeout(() => {
      setCurrentItem(null);
      // After presentation gap, show distractor
      setTimeout(() => {
        if (itemIdx >= length - 1 && config.distractorTypes.includes("arithmetic") === false && config.distractorTypes.includes("spatial") === false) {
          // no distractor configured on last item? go straight to recall
          setPhase("recall");
          startRef.current = performance.now();
          return;
        }
        // Always run a distractor after every item, then recall after the last one
        const d = generateDistractor(config, rngRef.current);
        setCurrentDistractor(d);
        setDistractorAnswer(null);
        setPhase("distractor");
      }, config.gapMs);
    }, config.presentationMs);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, itemIdx]);

  // Distractor timeout
  useEffect(() => {
    if (phase !== "distractor") return;
    timerRef.current = setTimeout(() => submitDistractor(null), config.distractorMs);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const submitDistractor = useCallback((choice) => {
    if (phase !== "distractor" || !currentDistractor) return;
    clearTimeout(timerRef.current);
    const correct = choice === currentDistractor.expected;
    distractorTotalRef.current++;
    if (correct) distractorHitsRef.current++;
    setDistractorAnswer(choice);
    if (settings.soundEnabled) beep({ freq: correct ? 880 : 220, duration: 40, volume: 0.06 });
    // Move to next item or recall
    setTimeout(() => {
      if (itemIdx >= length - 1) {
        setPhase("recall");
        startRef.current = performance.now();
      } else {
        setItemIdx((i) => i + 1);
        setPhase("present");
      }
    }, 300);
  }, [phase, currentDistractor, itemIdx, length, settings.soundEnabled]);

  // Recall submission
  const submitRecall = useCallback(() => {
    const rt = performance.now() - startRef.current;
    const raw = recallInput.trim();
    // Parse input based on itemType
    let parts;
    if (config.itemType === "words" || config.itemType === "colors" || config.itemType === "shapes" || config.itemType === "symbols" || config.itemType === "mixed") {
      parts = raw.split(/[\s,]+/).filter(Boolean);
    } else if (config.itemType === "numbers") {
      parts = (raw.match(/-?\d+/g) || []).map(Number);
    } else {
      // letters
      parts = raw.replace(/[\s,]+/g, "").toUpperCase().split("");
    }
    const normalize = (x) => (typeof x === "number" ? x : (String(x).length === 1 ? String(x).toUpperCase() : String(x).toLowerCase()));
    const given = parts.map(normalize);
    const expected = expectedRecall(sequenceRef.current, config.recall).map(normalize);

    let memoryCorrect;
    if (config.recall === "random") {
      // Set-match
      const es = [...expected].sort().join("|");
      const gs = [...given].sort().join("|");
      memoryCorrect = es === gs;
    } else {
      memoryCorrect = expected.length === given.length && expected.every((v, i) => v === given[i]);
    }
    // Position errors
    const positionErrors = Math.max(expected.length, given.length) -
      expected.filter((v, i) => v === given[i]).length;

    const distractorAccuracy = distractorTotalRef.current > 0
      ? distractorHitsRef.current / distractorTotalRef.current
      : 1;

    const attempt = {
      length,
      items: [...sequenceRef.current],
      expected,
      given,
      memoryCorrect,
      positionErrors,
      distractorHits: distractorHitsRef.current,
      distractorTotal: distractorTotalRef.current,
      distractorAccuracy,
      rtMs: rt,
      isTarget: true,
      responded: memoryCorrect,
    };
    attemptsRef.current.push(attempt);
    setRecallInput("");
    if (settings.soundEnabled) beep({ freq: memoryCorrect ? 880 : 220, duration: 60, volume: 0.08 });

    const newFailures = failuresAtLength + (memoryCorrect ? 0 : 1);
    if (memoryCorrect) {
      const nextLen = length + 1;
      if (nextLen > config.maxLength) {
        finish(attemptsRef.current);
        return;
      }
      setLength(nextLen);
      setFailuresAtLength(0);
      setPhase("feedback");
      setTimeout(startTrial, 900);
    } else {
      if (newFailures >= config.trialsPerLength) {
        finish(attemptsRef.current);
        return;
      }
      setFailuresAtLength(newFailures);
      setPhase("feedback");
      setTimeout(startTrial, 900);
    }
  }, [recallInput, config, length, failuresAtLength, settings.soundEnabled, startTrial]);

  const finish = useCallback((attempts) => {
    setPhase("finished");
    const total = attempts.length;
    const memCorrect = attempts.filter((a) => a.memoryCorrect).length;
    const memoryAccuracy = total ? memCorrect / total : 0;
    const totalDistHits = attempts.reduce((s, a) => s + a.distractorHits, 0);
    const totalDistTotal = attempts.reduce((s, a) => s + a.distractorTotal, 0);
    const distractorAccuracy = totalDistTotal ? totalDistHits / totalDistTotal : 1;
    // Absolute span: sum of lengths where memory was perfect
    const absoluteSpan = attempts.filter((a) => a.memoryCorrect).reduce((s, a) => s + a.length, 0);
    // Partial span: sum of correct items per attempt
    const partialSpan = attempts.reduce((s, a) => {
      const correct = a.expected.filter((v, i) => v === a.given[i]).length;
      return s + correct;
    }, 0);
    const maxSpan = attempts.filter((a) => a.memoryCorrect).reduce((m, a) => Math.max(m, a.length), 0);
    const combinedScore = memoryAccuracy * distractorAccuracy;
    // Generic stats trials
    const trials = attempts.map((a, i) => ({ index: i, isTarget: true, responded: a.memoryCorrect, rtMs: a.rtMs }));
    const summary = {
      totalTrials: total,
      correct: memCorrect,
      metrics: { accuracy: memoryAccuracy, precision: memoryAccuracy, recall: memoryAccuracy, f1: memoryAccuracy, specificity: 1 },
      rt: { mean: total ? attempts.reduce((s, a) => s + a.rtMs, 0) / total : null, median: null, min: null, max: null, stdev: null, count: total },
      memoryAccuracy,
      distractorAccuracy,
      absoluteSpan,
      partialSpan,
      maxSpan,
      combinedScore,
      orderErrors: attempts.reduce((s, a) => s + a.positionErrors, 0),
      positionErrors: attempts.reduce((s, a) => s + a.positionErrors, 0),
    };
    onFinish?.({ config, trials, summary, attempts });
  }, [config, onFinish]);

  // Render helpers
  const renderItem = (item) => {
    if (config.itemType === "colors") {
      return <div className="w-40 h-40 rounded-sm border border-border" style={{ background: item }} data-testid="ospan-item" />;
    }
    return <div className="font-display metric text-8xl md:text-9xl uppercase" data-testid="ospan-item">{item}</div>;
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="ospan-runner">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="overline">ospan · length {length} · item {itemIdx + 1}/{length}</div>
        <div className="text-xs text-muted-foreground metric">fails {failuresAtLength}/{config.trialsPerLength}</div>
        <Button variant="ghost" size="sm" onClick={onExit} data-testid="ospan-exit-btn"><X className="w-4 h-4" strokeWidth={1.5} /></Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8">
        {phase === "countdown" && (
          <div className="text-center">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {phase === "present" && (
          <>
            <div className="overline">memorize</div>
            {currentItem != null ? renderItem(currentItem) : <div className="text-muted-foreground overline">···</div>}
          </>
        )}
        {phase === "distractor" && currentDistractor && (
          <>
            <div className="overline">distractor · solve quickly</div>
            {currentDistractor.kind === "arithmetic" && (
              <div className="font-display metric text-5xl md:text-6xl" data-testid="ospan-distractor-prompt">{currentDistractor.prompt}</div>
            )}
            {currentDistractor.kind === "spatial" && (
              <div className="flex items-center gap-6">
                <SpatialPattern cells={currentDistractor.left} />
                <div className="text-2xl text-muted-foreground metric">vs</div>
                <SpatialPattern cells={currentDistractor.right} />
              </div>
            )}
            <div className="flex gap-3 mt-2">
              {currentDistractor.choices.map((c) => (
                <button
                  key={c.key}
                  onClick={() => submitDistractor(c.key)}
                  className={`min-w-[140px] px-5 py-3 rounded-sm border ${distractorAnswer === c.key ? "bg-primary/10 border-primary" : "bg-secondary/60 border-border"}`}
                  data-testid={`ospan-distractor-${c.key}`}
                  style={{ transitionProperty: "background-color, border-color", transitionDuration: "150ms" }}
                >
                  <div className="font-display">{c.label}</div>
                </button>
              ))}
            </div>
          </>
        )}
        {phase === "recall" && (
          <>
            <div className="overline">recall {config.recall} · {sequenceRef.current.length} items</div>
            <Input
              value={recallInput}
              onChange={(e) => setRecallInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitRecall(); }}
              placeholder="type sequence…"
              className="metric text-2xl h-14 w-80 text-center"
              data-testid="ospan-recall-input"
            />
            <Button onClick={submitRecall} data-testid="ospan-recall-submit">Submit</Button>
          </>
        )}
        {phase === "feedback" && (
          <div className="text-center">
            <div className="overline">next round</div>
            <div className="font-display text-2xl mt-2">length {length}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function SpatialPattern({ cells }) {
  return (
    <div className="grid grid-cols-2 gap-1">
      {cells.map((c, i) => (
        <div key={i} className={`w-14 h-14 border border-border ${c ? "bg-primary" : "bg-input"}`} />
      ))}
    </div>
  );
}
