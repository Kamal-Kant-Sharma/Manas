import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { X, Pause, Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { generateSequence, getTaskType } from "./module";
import { beep } from "../../lib/audio";
import { rtStats, summarizeSession, streaks } from "../../lib/stats";
import { useApp } from "../../lib/store";

const QUADRANT_LABELS = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

export default function TaskSwitchingRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const trials = useMemo(() => generateSequence(config), [config]);
  const [state, setState] = useState("countdown"); // countdown | running | paused | finished
  const [countdown, setCountdown] = useState(3);
  const [trialIdx, setTrialIdx] = useState(0);
  const [showStim, setShowStim] = useState(false);
  const [feedback, setFeedback] = useState(null); // "A" | "B"
  const trialStartRef = useRef(0);
  const stimTimer = useRef(null);
  const advTimer = useRef(null);
  const responsesRef = useRef([]); // { index, given, correct, rtMs, isSwitch, quadrant, rule }

  useEffect(() => {
    if (state !== "countdown") return;
    if (countdown <= 0) { setState("running"); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [state, countdown]);

  // Trial loop
  useEffect(() => {
    if (state !== "running") return;
    if (trialIdx >= trials.length) { finish(); return; }
    trialStartRef.current = performance.now();
    setShowStim(true);
    setFeedback(null);
    stimTimer.current = setTimeout(() => setShowStim(false), config.stimulusMs);
    advTimer.current = setTimeout(() => {
      commitNoResponse();
      setTrialIdx((i) => i + 1);
    }, config.stimulusMs + config.isiMs);
    return () => { clearTimeout(stimTimer.current); clearTimeout(advTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, trialIdx]);

  const commitNoResponse = useCallback(() => {
    const t = trials[trialIdx];
    if (!t) return;
    // If no response recorded for this idx, log it
    if (!responsesRef.current.find((r) => r.index === trialIdx)) {
      responsesRef.current.push({
        index: trialIdx,
        given: null,
        expected: t.expected,
        correct: false,
        rtMs: null,
        isSwitch: t.isSwitch,
        quadrant: t.quadrant,
        rule: t.rule,
      });
    }
  }, [trialIdx, trials]);

  const respond = useCallback((choice) => {
    if (state !== "running") return;
    const rt = performance.now() - trialStartRef.current;
    if (rt > config.reactionWindowMs) return;
    const t = trials[trialIdx];
    if (!t) return;
    if (responsesRef.current.find((r) => r.index === trialIdx)) return;
    const correct = choice === t.expected;
    responsesRef.current.push({
      index: trialIdx, given: choice, expected: t.expected,
      correct, rtMs: rt, isSwitch: t.isSwitch, quadrant: t.quadrant, rule: t.rule,
    });
    setFeedback(choice);
    if (settings.soundEnabled) beep({ freq: correct ? 880 : 220, duration: 60, volume: 0.08 });
    // advance quickly after response
    clearTimeout(advTimer.current);
    advTimer.current = setTimeout(() => setTrialIdx((i) => i + 1), 350);
  }, [state, trialIdx, trials, config.reactionWindowMs, settings.soundEnabled]);

  // Keyboard: F = A, J = B, Space = pause, Esc = exit
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") { onExit?.(); return; }
      if (e.key === " ") { e.preventDefault(); setState((s) => (s === "running" ? "paused" : s === "paused" ? "running" : s)); return; }
      const k = e.key.toLowerCase();
      if (k === "f") respond("A");
      if (k === "j") respond("B");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [respond, onExit]);

  const finish = useCallback(() => {
    setState("finished");
    const responses = responsesRef.current;
    // Scored trials as { isTarget, responded, rtMs } for generic stats.
    // For task-switching: "isTarget" = "there is a correct answer", "responded" = correct.
    const scoredForStats = responses.map((r) => ({
      isTarget: true,
      responded: r.correct,
      rtMs: r.correct ? r.rtMs : null,
    }));
    const rtAll = rtStats(responses.filter((r) => r.rtMs != null).map((r) => ({ responded: true, rtMs: r.rtMs })));
    const switchRTs = responses.filter((r) => r.isSwitch && r.correct && r.rtMs != null).map((r) => r.rtMs);
    const repeatRTs = responses.filter((r) => !r.isSwitch && r.correct && r.rtMs != null).map((r) => r.rtMs);
    const avg = (arr) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null;
    const meanSwitch = avg(switchRTs);
    const meanRepeat = avg(repeatRTs);
    const switchCostMs = meanSwitch != null && meanRepeat != null ? meanSwitch - meanRepeat : null;
    const nSwitch = responses.filter((r) => r.isSwitch).length;
    const nRepeat = responses.filter((r) => !r.isSwitch).length;
    const switchAcc = nSwitch ? responses.filter((r) => r.isSwitch && r.correct).length / nSwitch : null;
    const repeatAcc = nRepeat ? responses.filter((r) => !r.isSwitch && r.correct).length / nRepeat : null;
    // Per-quadrant + per-rule accuracy
    const perQuadrant = {};
    const perRule = {};
    for (let q = 0; q < 4; q++) {
      const arr = responses.filter((r) => r.quadrant === q);
      perQuadrant[q] = { total: arr.length, correct: arr.filter((r) => r.correct).length };
    }
    for (const r of responses) {
      if (!perRule[r.rule]) perRule[r.rule] = { total: 0, correct: 0 };
      perRule[r.rule].total++;
      if (r.correct) perRule[r.rule].correct++;
    }

    const base = summarizeSession(scoredForStats, {
      rt: rtAll,
      switchCostMs,
      meanSwitchRT: meanSwitch,
      meanRepeatRT: meanRepeat,
      switchAccuracy: switchAcc,
      repeatAccuracy: repeatAcc,
      perQuadrant,
      perRule,
      switchTrials: nSwitch,
      repeatTrials: nRepeat,
    });

    onFinish?.({ config, trials: responses, summary: base });
  }, [config, onFinish]);

  const t = trials[trialIdx];
  const q = t ? config.quadrants[t.quadrant] : null;
  const rule = q ? getTaskType(q.type) : null;
  const labels = rule ? rule.labels(q.params) : ["A", "B"];

  return (
    <div className="min-h-screen flex flex-col" data-testid="taskswitching-runner">
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="overline">task switching · {rule?.label || "—"}</div>
        <div className="text-xs text-muted-foreground metric">
          trial <span className="text-foreground">{Math.min(trialIdx + 1, trials.length)}</span> / {trials.length}
        </div>
        <Button variant="ghost" size="sm" onClick={onExit} data-testid="ts-exit-btn"><X className="w-4 h-4" strokeWidth={1.5} /></Button>
      </div>
      <div className="h-0.5 bg-border">
        <div className="h-full bg-primary" style={{ width: `${(trialIdx / trials.length) * 100}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 py-6">
        {state === "countdown" && (
          <div className="text-center">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {state === "paused" && (
          <div className="text-center"><div className="overline">paused</div><div className="font-display text-2xl mt-2">Space to resume</div></div>
        )}
        {state === "running" && t && (
          <>
            <div className="text-xs text-muted-foreground overline">rule: {rule?.label}</div>
            {/* 2x2 quadrant grid */}
            <div className="grid grid-cols-2 grid-rows-2 border border-border" style={{ width: 380, height: 380 }} data-testid="ts-grid">
              {[0,1,2,3].map((qi) => {
                const activeCell = t.quadrant === qi && showStim;
                const stim = t.stimulus;
                const cellBg = activeCell && stim.bgColor ? stim.bgColor : undefined;
                const cellFg = activeCell && stim.fontColor ? stim.fontColor : "hsl(var(--foreground))";
                return (
                  <div
                    key={qi}
                    className={`border border-border relative flex items-center justify-center ${qi === 1 || qi === 3 ? "border-l" : ""} ${qi === 2 || qi === 3 ? "border-t" : ""}`}
                    style={{ background: cellBg || "hsl(var(--input))" }}
                    data-testid={`ts-quadrant-${qi}`}
                  >
                    <div className="overline absolute top-2 left-3 text-[9px]">{QUADRANT_LABELS[qi]}</div>
                    {activeCell && (
                      <div className="font-display metric text-6xl" style={{ color: cellFg }} data-testid="ts-stimulus">
                        {stim.letter}{stim.number}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Response buttons */}
      <div className="border-t border-border p-4 flex items-center justify-center gap-3">
        <button
          onClick={() => respond("A")}
          disabled={state !== "running"}
          data-testid="ts-respond-A"
          className={`min-w-[180px] px-6 py-4 rounded-sm border ${feedback === "A" ? "bg-primary/10 border-primary" : "bg-secondary/60 border-border"}`}
          style={{ transitionProperty: "background-color, border-color", transitionDuration: "150ms" }}
        >
          <div className="overline">F</div>
          <div className="font-display text-lg mt-1">{labels[0]}</div>
        </button>
        <button
          onClick={() => respond("B")}
          disabled={state !== "running"}
          data-testid="ts-respond-B"
          className={`min-w-[180px] px-6 py-4 rounded-sm border ${feedback === "B" ? "bg-primary/10 border-primary" : "bg-secondary/60 border-border"}`}
          style={{ transitionProperty: "background-color, border-color", transitionDuration: "150ms" }}
        >
          <div className="overline">J</div>
          <div className="font-display text-lg mt-1">{labels[1]}</div>
        </button>
      </div>
    </div>
  );
}
