import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Pause, Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { generatePASAT, PASAT_OPS } from "./module";
import { speak, stopSpeaking, beep } from "../../lib/audio";
import { rtStats, streaks } from "../../lib/stats";
import { useApp } from "../../lib/store";

export default function PASATRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const { numbers, ops, expected, windowSize } = useMemo(() => generatePASAT(config), [config]);
  const [state, setState] = useState("countdown");
  const [countdown, setCountdown] = useState(3);
  const [trialIdx, setTrialIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const trialsRef = useRef([]); // { index, presented, expected, given, correct, rtMs, op }
  const inputRef = useRef(null);
  const trialStartRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (state !== "countdown") return;
    if (countdown <= 0) { setState("running"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [state, countdown]);

  const submitAnswer = useCallback((autoTimeout = false) => {
    const idx = trialIdx;
    if (idx < windowSize - 1) return;
    const rt = performance.now() - trialStartRef.current;
    const given = answer === "" ? null : Number(answer);
    const exp = expected[idx];
    const correct = given != null && Math.abs(given - exp) < 1e-6;
    trialsRef.current.push({
      index: idx,
      op: ops[idx],
      presented: numbers[idx],
      window: numbers.slice(Math.max(0, idx - windowSize + 1), idx + 1),
      expected: exp,
      given,
      correct,
      skipped: given == null,
      rtMs: given != null ? rt : null,
      // Classification for generic stats engine
      isTarget: true, // every non-first trial has an expected answer
      responded: correct,
    });
    if (settings.soundEnabled) beep({ freq: correct ? 880 : 220, duration: 60, volume: 0.08 });
    setAnswer("");
  }, [answer, trialIdx, expected, numbers, ops, settings.soundEnabled, windowSize]);

  // Trial loop
  useEffect(() => {
    if (state !== "running") return;
    if (trialIdx >= numbers.length) { finish(); return; }
    trialStartRef.current = performance.now();
    // Speak the number
    if (config.audio && settings.soundEnabled) {
      speak(String(numbers[trialIdx]), {
        rate: 1.1, pitch: 1, volume: 1, voiceName: settings.voiceName,
      });
    }
    if (inputRef.current) inputRef.current.focus();
    timerRef.current = setTimeout(() => {
      submitAnswer(true);
      setTrialIdx((i) => i + 1);
    }, config.intervalMs);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, trialIdx]);

  const finish = useCallback(() => {
    setState("finished");
    stopSpeaking();
    const trials = trialsRef.current;
    const correct = trials.filter((t) => t.correct).length;
    const incorrect = trials.filter((t) => !t.correct && !t.skipped).length;
    const skipped = trials.filter((t) => t.skipped).length;
    const total = trials.length;
    const accuracy = total ? correct / total : 0;
    const perOp = {};
    for (const t of trials) {
      const key = t.op;
      if (!perOp[key]) perOp[key] = { correct: 0, total: 0 };
      perOp[key].total++;
      if (t.correct) perOp[key].correct++;
    }
    const summary = {
      totalTrials: total,
      correct,
      incorrect,
      skipped,
      metrics: { accuracy, precision: accuracy, recall: accuracy, f1: accuracy, specificity: 1 },
      rt: rtStats(trials),
      streaks: streaks(trials),
      perOperation: perOp,
    };
    onFinish?.({ config, trials, summary });
  }, [config, onFinish]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (state !== "running") return;
    submitAnswer();
    clearTimeout(timerRef.current);
    setTrialIdx((i) => i + 1);
  };

  const currentOp = PASAT_OPS.find((o) => o.key === ops[trialIdx]) || PASAT_OPS[0];

  return (
    <div className="min-h-screen flex flex-col" data-testid="pasat-runner">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="overline">pasat · {currentOp.label.toLowerCase()}</div>
        <div className="text-xs text-muted-foreground metric">
          trial <span className="text-foreground">{Math.min(trialIdx + 1, numbers.length)}</span> / {numbers.length}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setState((s) => (s === "paused" ? "running" : s === "running" ? "paused" : s))} data-testid="pasat-pause-btn">
            {state === "paused" ? <Play className="w-4 h-4" strokeWidth={1.5} /> : <Pause className="w-4 h-4" strokeWidth={1.5} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { stopSpeaking(); onExit?.(); }} data-testid="pasat-exit-btn">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>
      <div className="h-0.5 bg-border">
        <div className="h-full bg-primary" style={{ width: `${(trialIdx / numbers.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {state === "countdown" && (
          <div className="text-center">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {state === "running" && (
          <>
            {config.visual && (
              <div className="metric text-8xl md:text-9xl font-display" data-testid="pasat-number">{numbers[trialIdx]}</div>
            )}
            {!config.visual && <div className="overline">listen</div>}
            <div className="text-xs text-muted-foreground">
              {windowSize === 2
                ? <>enter <span className="metric text-foreground">previous {currentOp.symbol} current</span></>
                : <>combine <span className="metric text-foreground">last {windowSize}</span> with <span className="metric text-foreground">{currentOp.symbol}</span></>}
            </div>
            <form onSubmit={handleSubmit} className="flex items-center gap-2">
              <Input
                ref={inputRef}
                type="number"
                inputMode="numeric"
                autoFocus
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="metric text-3xl h-14 w-40 text-center"
                data-testid="pasat-input"
              />
              <Button type="submit" data-testid="pasat-submit">Submit</Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
