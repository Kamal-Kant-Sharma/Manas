import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { generateSequence, expectedAnswer, MEMORY_STIMULI } from "./module";
import { speak, stopSpeaking, beep } from "../../lib/audio";
import { useApp } from "../../lib/store";

export default function MemorySpanRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const [length, setLength] = useState(config.startLength);
  const [phase, setPhase] = useState("countdown"); // countdown | present | recall | feedback | finished
  const [countdown, setCountdown] = useState(3);
  const [sequence, setSequence] = useState([]);
  const [showIdx, setShowIdx] = useState(-1);
  const [userInput, setUserInput] = useState("");
  const [attempts, setAttempts] = useState([]);
  const [attemptsAtLength, setAttemptsAtLength] = useState(0);
  const [failuresAtLength, setFailuresAtLength] = useState(0);
  const startRef = useRef(0);
  const timerRef = useRef(null);

  const startTrial = useCallback(() => {
    const seq = generateSequence(length, config);
    setSequence(seq);
    setUserInput("");
    setShowIdx(-1);
    setPhase("present");
  }, [length, config]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startTrial(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, startTrial]);

  // Presentation loop
  useEffect(() => {
    if (phase !== "present") return;
    let i = 0;
    const step = () => {
      if (i >= sequence.length) {
        setShowIdx(-1);
        setPhase("recall");
        startRef.current = performance.now();
        return;
      }
      setShowIdx(i);
      const isAudio = config.stimulus === "audio-letters" || config.stimulus === "audio-digits";
      if (isAudio && settings.soundEnabled) {
        speak(String(sequence[i]), { rate: 1, pitch: 1, volume: 1 });
      }
      timerRef.current = setTimeout(() => {
        setShowIdx(-1);
        timerRef.current = setTimeout(() => { i++; step(); }, config.gapMs);
      }, config.presentationMs);
    };
    step();
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequence]);

  const submitRecall = useCallback(() => {
    const rt = performance.now() - startRef.current;
    const raw = userInput.trim();
    // Parse: allow comma/space/none between items
    let parts;
    if (config.stimulus === "words" || config.stimulus === "colors" || config.stimulus === "shapes") {
      parts = raw.split(/[\s,]+/).filter(Boolean);
    } else if (config.stimulus === "positions") {
      parts = raw.split(/[\s,]+/).filter(Boolean).map((x) => Number(x));
    } else if (config.stimulus === "digits" || config.stimulus === "audio-digits") {
      // Digits: split on non-digit or take each char
      if (raw.includes(" ") || raw.includes(",")) parts = raw.split(/[\s,]+/).filter(Boolean).map(Number);
      else parts = raw.split("").map(Number);
    } else {
      // letters / audio-letters
      parts = raw.replace(/\s+/g, "").toUpperCase().split("");
    }
    const expected = expectedAnswer(sequence, config.recall).map((x) => {
      if (typeof x === "number") return x;
      if (typeof x === "string") return x.length === 1 ? x.toUpperCase() : x.toLowerCase();
      return x;
    });
    const given = parts.map((x) => {
      if (typeof x === "number") return x;
      return x.length === 1 ? x.toUpperCase() : x.toLowerCase();
    });
    let orderErrors = 0, positionErrors = 0;
    const lenMatch = expected.length === given.length;
    for (let i = 0; i < Math.max(expected.length, given.length); i++) {
      if (expected[i] !== given[i]) positionErrors++;
    }
    // order errors: same set, wrong order
    const expSet = [...expected].sort().join("|");
    const givSet = [...given].sort().join("|");
    if (expSet === givSet && !lenMatch === false && positionErrors > 0) orderErrors = positionErrors;
    const success = positionErrors === 0 && lenMatch;

    const attempt = {
      length,
      sequence,
      expected,
      given,
      success,
      lenMatch,
      positionErrors,
      orderErrors,
      rtMs: rt,
      // for generic stats
      isTarget: true,
      responded: success,
    };
    setAttempts((prev) => [...prev, attempt]);
    if (settings.soundEnabled) beep({ freq: success ? 880 : 220, duration: 60, volume: 0.08 });

    // Advance
    const newAttempts = attemptsAtLength + 1;
    const newFailures = failuresAtLength + (success ? 0 : 1);

    if (success) {
      // Move to next length
      const nextLen = length + 1;
      if (nextLen > config.maxLength) {
        finish([...attempts, attempt]);
        return;
      }
      setLength(nextLen);
      setAttemptsAtLength(0);
      setFailuresAtLength(0);
      setPhase("feedback");
      setTimeout(() => startTrial(), 900);
    } else {
      if (newFailures >= config.trialsPerLength) {
        // stop, max span = length - 1
        finish([...attempts, attempt]);
        return;
      }
      setAttemptsAtLength(newAttempts);
      setFailuresAtLength(newFailures);
      setPhase("feedback");
      setTimeout(() => startTrial(), 900);
    }
  }, [userInput, sequence, length, config, attempts, attemptsAtLength, failuresAtLength, settings.soundEnabled, startTrial]);

  const finish = useCallback((allAttempts) => {
    setPhase("finished");
    stopSpeaking();
    const maxSpan = allAttempts.filter((a) => a.success).reduce((m, a) => Math.max(m, a.length), 0);
    const total = allAttempts.length;
    const correct = allAttempts.filter((a) => a.success).length;
    const accuracy = total ? correct / total : 0;
    const meanRT = total ? allAttempts.reduce((s, a) => s + a.rtMs, 0) / total : null;
    const orderErrors = allAttempts.reduce((s, a) => s + a.orderErrors, 0);
    const positionErrors = allAttempts.reduce((s, a) => s + a.positionErrors, 0);
    const summary = {
      maxSpan,
      totalTrials: total,
      correct,
      metrics: { accuracy, precision: accuracy, recall: accuracy, f1: accuracy, specificity: 1 },
      rt: { mean: meanRT, median: meanRT, min: meanRT, max: meanRT, stdev: 0, count: total },
      orderErrors,
      positionErrors,
    };
    // trials for generic engine
    const trials = allAttempts.map((a, i) => ({ index: i, isTarget: true, responded: a.success, rtMs: a.rtMs }));
    onFinish?.({ config, trials, summary, attempts: allAttempts });
  }, [config, onFinish]);

  // Render the current stimulus item
  const renderStim = () => {
    if (showIdx < 0 || !sequence[showIdx] === undefined) return null;
    const item = sequence[showIdx];
    if (config.stimulus === "positions") {
      return (
        <div className="grid grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className={`stim-cell ${i === item ? "active" : ""}`} style={{ width: 64, height: 64 }} />
          ))}
        </div>
      );
    }
    if (config.stimulus === "colors") {
      return <div className="w-40 h-40 rounded-sm" style={{ background: item }} />;
    }
    return <div className="metric text-8xl md:text-9xl font-display uppercase">{item}</div>;
  };

  const isVisible = phase === "present" && showIdx >= 0;

  return (
    <div className="min-h-screen flex flex-col" data-testid="memory-span-runner">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="overline">memory span · {config.stimulus} / {config.recall}</div>
        <div className="text-xs text-muted-foreground metric">length <span className="text-foreground">{length}</span> · fails {failuresAtLength}/{config.trialsPerLength}</div>
        <Button variant="ghost" size="sm" onClick={() => { stopSpeaking(); onExit?.(); }} data-testid="memory-exit-btn"><X className="w-4 h-4" strokeWidth={1.5} /></Button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {phase === "countdown" && (
          <div className="text-center">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {phase === "present" && (
          <div className="min-h-[240px] flex items-center justify-center">
            {isVisible ? renderStim() : <div className="text-muted-foreground overline">···</div>}
          </div>
        )}
        {phase === "recall" && (
          <>
            <div className="overline">recall {config.recall} ({sequence.length} items)</div>
            <Input
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") submitRecall(); }}
              placeholder="type sequence…"
              className="metric text-2xl h-14 w-80 text-center"
              data-testid="memory-input"
            />
            <Button onClick={submitRecall} data-testid="memory-submit-btn">Submit</Button>
            <div className="text-xs text-muted-foreground">separate with spaces/commas · digits & letters can be concatenated</div>
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
