import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { X, Pause, Play } from "lucide-react";
import { Button } from "../../components/ui/button";
import { NBACK_STREAMS, generateSequence, alphabetFor } from "./module";
import { speak, stopSpeaking, beep } from "../../lib/audio";
import { summarizeSession, perStreamSummary } from "../../lib/stats";
import { useApp } from "../../lib/store";

export default function NBackRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const nav = useNavigate();
  const { trials, activeStreams } = useMemo(() => generateSequence(config), [config]);
  const [state, setState] = useState("countdown"); // countdown | running | paused | finished
  const [countdown, setCountdown] = useState(3);
  const [trialIdx, setTrialIdx] = useState(0);
  const [showStim, setShowStim] = useState(false);
  const [responses, setResponses] = useState({}); // { trialIdx: { [streamKey]: {rtMs} } }
  const [feedbackFlash, setFeedbackFlash] = useState(null); // { key, ok }

  const trialStartRef = useRef(0);
  const trialTimerRef = useRef(null);
  const stimTimerRef = useRef(null);
  const responsesRef = useRef({});

  useEffect(() => { responsesRef.current = responses; }, [responses]);

  // Countdown
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

    const trial = trials[trialIdx];
    trialStartRef.current = performance.now();
    setShowStim(true);

    // Fire audio stimuli
    if (settings.soundEnabled) {
      for (const k of activeStreams) {
        if (k === "audioLetter" || k === "audioNumber") {
          speak(String(trial.stimuli[k]), {
            rate: config.audioRate ?? 1,
            pitch: config.audioPitch ?? 1,
            volume: config.audioVolume ?? 1,
            voiceName: config.audioVoice,
          });
        }
      }
    }

    // Hide visual stim after stimulusMs
    stimTimerRef.current = setTimeout(() => setShowStim(false), config.stimulusMs);

    // Advance to next trial after (stimulusMs + isiMs)
    trialTimerRef.current = setTimeout(() => {
      setTrialIdx((i) => i + 1);
    }, config.stimulusMs + config.isiMs);

    return () => {
      clearTimeout(stimTimerRef.current);
      clearTimeout(trialTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, trialIdx]);

  // Keyboard handling
  useEffect(() => {
    function onKey(e) {
      if (state !== "running") {
        if (e.key === "Escape") onExit?.();
        if (e.key === " " && state === "paused") togglePause();
        return;
      }
      if (e.key === "Escape") { setState("paused"); return; }
      if (e.key === " " || e.code === "Space") { setState("paused"); e.preventDefault(); return; }
      // Match keys to stream hotkeys
      const key = e.key.toLowerCase();
      const stream = NBACK_STREAMS.find((s) => s.hotkey === key && activeStreams.includes(s.key));
      if (stream) {
        e.preventDefault();
        registerResponse(stream.key);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, trialIdx, activeStreams]);

  const registerResponse = useCallback((streamKey) => {
    const rt = performance.now() - trialStartRef.current;
    if (rt > (config.reactionWindowMs ?? 2200)) return;
    setResponses((prev) => {
      const cur = { ...(prev[trialIdx] || {}) };
      if (cur[streamKey]) return prev; // one response per stream per trial
      cur[streamKey] = { rtMs: rt };
      return { ...prev, [trialIdx]: cur };
    });
    const isTarget = trials[trialIdx]?.targets?.[streamKey];
    setFeedbackFlash({ key: streamKey, ok: !!isTarget });
    if (settings.soundEnabled) beep({ freq: isTarget ? 880 : 220, duration: 60, volume: 0.08 });
    setTimeout(() => setFeedbackFlash(null), 320);
  }, [trialIdx, trials, config.reactionWindowMs, settings.soundEnabled]);

  const togglePause = useCallback(() => {
    setState((s) => (s === "running" ? "paused" : s === "paused" ? "running" : s));
  }, []);

  const finish = useCallback(() => {
    setState("finished");
    stopSpeaking();
    // Build final trial-level scoring records
    const scored = trials.map((t, i) => {
      const perStream = {};
      for (const k of activeStreams) {
        const resp = responsesRef.current[i]?.[k];
        perStream[k] = {
          isTarget: !!t.targets[k],
          responded: !!resp,
          rtMs: resp?.rtMs ?? null,
          value: t.stimuli[k],
        };
      }
      // Aggregate: trial is target if ANY stream is target; responded if user hit ANY stream response
      const anyTarget = activeStreams.some((k) => t.targets[k]);
      const anyResp = activeStreams.some((k) => !!responsesRef.current[i]?.[k]);
      // reaction time for aggregate: min RT across streams responded
      const rts = activeStreams
        .map((k) => responsesRef.current[i]?.[k]?.rtMs)
        .filter((x) => x != null);
      return {
        index: i,
        isWarmup: t.isWarmup,
        isTarget: anyTarget,
        responded: anyResp,
        rtMs: rts.length ? Math.min(...rts) : null,
        perStream,
        stimuli: t.stimuli,
        targets: t.targets,
      };
    });

    const scoredNoWarmup = scored.filter((s) => !s.isWarmup);
    const summary = summarizeSession(scoredNoWarmup, {
      perStream: perStreamSummary(scoredNoWarmup, activeStreams),
    });

    onFinish?.({ config, trials: scored, summary });
  }, [trials, activeStreams, config, onFinish]);

  // Render helpers
  const trial = trials[trialIdx];
  const gridSize = config.gridSize;

  return (
    <div className="min-h-screen flex flex-col" data-testid="nback-runner">
      {/* Top status bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border">
        <div className="flex items-center gap-4">
          <div className="overline">n-back · n={config.n}</div>
          <div className="text-xs text-muted-foreground metric">
            trial <span className="text-foreground">{Math.min(trialIdx + 1, trials.length)}</span> / {trials.length}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={togglePause} data-testid="nback-pause-btn">
            {state === "paused" ? <Play className="w-4 h-4" strokeWidth={1.5} /> : <Pause className="w-4 h-4" strokeWidth={1.5} />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { stopSpeaking(); onExit?.(); }} data-testid="nback-exit-btn">
            <X className="w-4 h-4" strokeWidth={1.5} />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-border">
        <div
          className="h-full bg-primary"
          style={{ width: `${(trialIdx / trials.length) * 100}%`, transition: "width 200ms linear" }}
        />
      </div>

      {/* Main stimulus area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-10 relative">
        {state === "countdown" && (
          <div className="text-center" data-testid="nback-countdown">
            <div className="overline">get ready</div>
            <div className="metric text-8xl font-display mt-4">{countdown || "GO"}</div>
          </div>
        )}
        {state === "paused" && (
          <div className="text-center" data-testid="nback-paused">
            <div className="overline">paused</div>
            <div className="font-display text-3xl mt-2">Press space to resume</div>
          </div>
        )}
        {(state === "running" || state === "finished") && trial && (
          <>
            {/* Visual stimulus grid (position, color background) */}
            {(config.streams.position || config.streams.color || config.streams.number || config.streams.letter || config.streams.shape || config.streams.symbol) && (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${gridSize}, 64px)`,
                  gap: 4,
                }}
              >
                {Array.from({ length: gridSize * gridSize }).map((_, cell) => {
                  const isActive = showStim && config.streams.position && trial.stimuli.position === cell;
                  const activeCell = showStim && !config.streams.position && cell === Math.floor((gridSize * gridSize) / 2);
                  const showCell = isActive || activeCell;
                  const bg = showCell && config.streams.color ? trial.stimuli.color : null;
                  return (
                    <div
                      key={cell}
                      className={`stim-cell ${showCell ? "active" : ""}`}
                      style={bg ? { background: bg } : {}}
                      data-testid={`nback-cell-${cell}`}
                    >
                      {showCell && (
                        <div className="absolute inset-0 flex items-center justify-center font-display text-2xl md:text-3xl" style={{ color: bg ? "#1a1b26" : "hsl(var(--primary-foreground))" }}>
                          {config.streams.letter && trial.stimuli.letter}
                          {config.streams.number && trial.stimuli.number}
                          {config.streams.symbol && trial.stimuli.symbol}
                          {config.streams.shape && !config.streams.letter && !config.streams.number && !config.streams.symbol && (
                            <span className="metric text-xs uppercase" style={{ color: bg ? "#1a1b26" : "hsl(var(--primary-foreground))" }}>{trial.stimuli.shape}</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {/* Audio-only indicator when no visual stream */}
            {!config.streams.position && !config.streams.color && !config.streams.number && !config.streams.letter && !config.streams.shape && !config.streams.symbol && (
              <div className="text-center">
                <div className="overline">listen</div>
                <div className={`w-24 h-24 mt-4 rounded-sm border border-border mx-auto ${showStim ? "bg-primary" : ""}`} />
              </div>
            )}
          </>
        )}
      </div>

      {/* Response buttons — one per active stream */}
      <div className="border-t border-border">
        <div className="flex items-stretch justify-center gap-2 px-4 py-4 flex-wrap">
          {activeStreams.map((k) => {
            const s = NBACK_STREAMS.find((x) => x.key === k);
            const responded = !!responses[trialIdx]?.[k];
            const flashing = feedbackFlash?.key === k;
            const flashCls = flashing ? (feedbackFlash.ok ? "flash-good" : "flash-bad") : "";
            return (
              <button
                key={k}
                onClick={() => registerResponse(k)}
                disabled={state !== "running"}
                data-testid={`nback-respond-${k}`}
                className={`min-w-[140px] px-4 py-3 rounded-sm border ${responded ? "bg-primary/10 border-primary" : "bg-secondary/60 border-border"} text-left ${flashCls}`}
                style={{ transitionProperty: "background-color, border-color", transitionDuration: "150ms" }}
              >
                <div className="overline">match · {s.hotkey.toUpperCase()}</div>
                <div className="font-display text-base mt-1">{s.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
