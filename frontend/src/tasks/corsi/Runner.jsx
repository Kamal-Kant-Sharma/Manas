import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { generateLayout, generateSequence, makeRng } from "./module";
import { beep } from "../../lib/audio";
import { useApp } from "../../lib/store";

export default function CorsiRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const rngRef = useRef(makeRng(config.seed));
  const layout = useMemo(() => generateLayout(config, rngRef.current), [config]);
  const [length, setLength] = useState(config.startLength);
  const [phase, setPhase] = useState("countdown"); // countdown | present | recall | feedback | finished
  const [countdown, setCountdown] = useState(3);
  const [sequence, setSequence] = useState([]);
  const [showIdx, setShowIdx] = useState(-1);
  const [tapped, setTapped] = useState([]);
  const [feedbackBlock, setFeedbackBlock] = useState(null); // { idx, ok }
  const [failuresAtLength, setFailuresAtLength] = useState(0);
  const attemptsRef = useRef([]);
  const startRef = useRef(0);
  const timerRef = useRef(null);
  const recallTimeoutRef = useRef(null);

  const startTrial = useCallback(() => {
    const seq = generateSequence(config.blocks, length, rngRef.current);
    setSequence(seq);
    setTapped([]);
    setShowIdx(-1);
    setFeedbackBlock(null);
    setPhase("present");
  }, [config.blocks, length]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startTrial(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, startTrial]);

  // Present sequence
  useEffect(() => {
    if (phase !== "present") return;
    let i = 0;
    const step = () => {
      if (i >= sequence.length) {
        setShowIdx(-1);
        setPhase("recall");
        startRef.current = performance.now();
        recallTimeoutRef.current = setTimeout(() => submitRecall([...tappedRef.current]), config.recallTimeoutMs);
        return;
      }
      setShowIdx(sequence[i]);
      timerRef.current = setTimeout(() => {
        setShowIdx(-1);
        timerRef.current = setTimeout(() => { i++; step(); }, config.gapMs);
      }, config.presentationMs);
    };
    step();
    return () => { clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, sequence]);

  const tappedRef = useRef([]);
  useEffect(() => { tappedRef.current = tapped; }, [tapped]);

  const submitRecall = useCallback((given) => {
    clearTimeout(recallTimeoutRef.current);
    const rt = performance.now() - startRef.current;
    const expected = config.recall === "backward" ? [...sequence].reverse() : [...sequence];
    const positionErrors = Math.max(expected.length, given.length) -
      expected.filter((v, i) => v === given[i]).length;
    const success = expected.length === given.length && positionErrors === 0;

    const attempt = {
      length, sequence, expected, given, success,
      positionErrors, orderErrors: positionErrors, rtMs: rt,
      isTarget: true, responded: success,
    };
    attemptsRef.current.push(attempt);
    if (settings.soundEnabled) beep({ freq: success ? 880 : 220, duration: 80, volume: 0.08 });

    const newFail = failuresAtLength + (success ? 0 : 1);
    if (success) {
      const nextLen = length + 1;
      if (nextLen > config.maxLength) return finish();
      setLength(nextLen);
      setFailuresAtLength(0);
      setPhase("feedback");
      setTimeout(startTrial, 900);
    } else {
      if (newFail >= config.trialsPerLength) return finish();
      setFailuresAtLength(newFail);
      setPhase("feedback");
      setTimeout(startTrial, 900);
    }
  }, [config, length, sequence, failuresAtLength, startTrial, settings.soundEnabled]);

  const finish = useCallback(() => {
    setPhase("finished");
    const attempts = attemptsRef.current;
    const total = attempts.length;
    const correct = attempts.filter((a) => a.success).length;
    const accuracy = total ? correct / total : 0;
    const meanRT = total ? attempts.reduce((s, a) => s + a.rtMs, 0) / total : null;
    const maxSpan = attempts.filter((a) => a.success).reduce((m, a) => Math.max(m, a.length), 0);
    const orderErrors = attempts.reduce((s, a) => s + a.orderErrors, 0);
    const summary = {
      totalTrials: total,
      correct,
      maxSpan,
      orderErrors,
      positionErrors: orderErrors,
      metrics: { accuracy, precision: accuracy, recall: accuracy, f1: accuracy, specificity: 1 },
      rt: { mean: meanRT, median: meanRT, min: meanRT, max: meanRT, stdev: 0, count: total },
    };
    const trials = attempts.map((a, i) => ({ index: i, isTarget: true, responded: a.success, rtMs: a.rtMs }));
    onFinish?.({ config, trials, summary, attempts });
  }, [config, onFinish]);

  const onTap = (idx) => {
    if (phase !== "recall") return;
    if (tapped.includes(idx)) return; // no double-tap on same block
    setFeedbackBlock({ idx, ok: true });
    setTimeout(() => setFeedbackBlock(null), 220);
    const next = [...tapped, idx];
    setTapped(next);
    if (next.length >= sequence.length) {
      setTimeout(() => submitRecall(next), 200);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" data-testid="corsi-runner">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="overline">corsi · length {length} · {config.recall}</div>
        <div className="text-xs text-muted-foreground metric">fails {failuresAtLength}/{config.trialsPerLength}</div>
        <Button variant="ghost" size="sm" onClick={onExit} data-testid="corsi-exit-btn"><X className="w-4 h-4" strokeWidth={1.5} /></Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-8">
        {phase === "countdown" && (
          <div className="text-center">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {(phase === "present" || phase === "recall" || phase === "feedback") && (
          <>
            <div className="overline">
              {phase === "present" && "watch"}
              {phase === "recall" && (config.recall === "backward" ? "tap in reverse order" : "tap in order")}
              {phase === "feedback" && "next"}
            </div>
            <div
              className="relative border border-border bg-input"
              style={{ width: 480, height: 480 }}
              data-testid="corsi-board"
            >
              {layout.map((pos, i) => {
                const isLit = showIdx === i;
                const isTapped = tapped.includes(i);
                const isFeedback = feedbackBlock?.idx === i;
                return (
                  <button
                    key={i}
                    onClick={() => onTap(i)}
                    disabled={phase !== "recall"}
                    data-testid={`corsi-block-${i}`}
                    className="absolute rounded-sm border border-border"
                    style={{
                      left: `${pos.x}%`, top: `${pos.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: 60, height: 60,
                      background: isLit
                        ? "hsl(var(--primary))"
                        : isTapped
                          ? "hsl(var(--chart-3))"
                          : "hsl(var(--card))",
                      boxShadow: isFeedback ? "inset 0 0 0 2px hsl(var(--chart-3))" : "none",
                      transition: "background-color 120ms ease-out",
                    }}
                  />
                );
              })}
            </div>
            {phase === "recall" && (
              <div className="text-xs text-muted-foreground metric">tapped {tapped.length} / {sequence.length}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
