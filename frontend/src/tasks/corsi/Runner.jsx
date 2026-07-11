import React, { useEffect, useRef, useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { generateBlocks, expectedOrder, makeRng } from "./module";
import { beep } from "../../lib/audio";
import { useApp } from "../../lib/store";

const BOARD_SIZE = 480;

export default function CorsiRunner({ config, onFinish, onExit }) {
  const { settings } = useApp();
  const rngRef = useRef(makeRng(config.seed));
  const [length, setLength] = useState(config.startLength);
  const [phase, setPhase] = useState("countdown"); // countdown | present | recall | feedback | finished
  const [countdown, setCountdown] = useState(3);
  const [blocks, setBlocks] = useState([]);       // [{id, x, y, blockPx}]
  const [litIdx, setLitIdx] = useState(-1);       // block id currently lit during presentation
  const [tapped, setTapped] = useState([]);       // list of block ids in click order
  const [removed, setRemoved] = useState(() => new Set());
  const [flashBlock, setFlashBlock] = useState(null); // { id, ok }
  const [failuresAtLength, setFailuresAtLength] = useState(0);
  const attemptsRef = useRef([]);
  const startRef = useRef(0);
  const presentTimer = useRef(null);
  const recallTimeout = useRef(null);
  const tappedRef = useRef([]);
  useEffect(() => { tappedRef.current = tapped; }, [tapped]);

  const startTrial = useCallback(() => {
    const bs = generateBlocks(length, rngRef.current, BOARD_SIZE);
    setBlocks(bs);
    setLitIdx(-1);
    setTapped([]);
    setRemoved(new Set());
    setFlashBlock(null);
    setPhase("present");
  }, [length]);

  useEffect(() => {
    if (phase !== "countdown") return;
    if (countdown <= 0) { startTrial(); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, countdown, startTrial]);

  // Presentation: light each block in creation order
  useEffect(() => {
    if (phase !== "present" || blocks.length === 0) return;
    let i = 0;
    const step = () => {
      if (i >= blocks.length) {
        setLitIdx(-1);
        setPhase("recall");
        startRef.current = performance.now();
        // Kick off recall timeout
        recallTimeout.current = setTimeout(() => {
          submitRecall(tappedRef.current);
        }, config.recallTimeoutMs);
        return;
      }
      setLitIdx(blocks[i].id);
      presentTimer.current = setTimeout(() => {
        setLitIdx(-1);
        presentTimer.current = setTimeout(() => { i++; step(); }, config.gapMs);
      }, config.presentationMs);
    };
    step();
    return () => { clearTimeout(presentTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, blocks]);

  const submitRecall = useCallback((given) => {
    clearTimeout(recallTimeout.current);
    if (phase === "finished" || phase === "feedback") return;
    const rt = performance.now() - startRef.current;
    const expected = expectedOrder(blocks.map((b) => b.id), config.recall);
    // Score: length match AND order match
    const orderErrors = expected.reduce((s, id, i) => s + (given[i] === id ? 0 : 1), 0);
    const success = expected.length === given.length && orderErrors === 0;

    const attempt = {
      length,
      sequence: expected,
      given,
      success,
      positionErrors: orderErrors,
      orderErrors,
      rtMs: rt,
      isTarget: true,
      responded: success,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, config.recall, config.maxLength, config.trialsPerLength, length, failuresAtLength, phase, settings.soundEnabled, startTrial]);

  const finish = useCallback(() => {
    setPhase("finished");
    const attempts = attemptsRef.current;
    const total = attempts.length;
    const correct = attempts.filter((a) => a.success).length;
    const accuracy = total ? correct / total : 0;
    const rts = attempts.map((a) => a.rtMs).filter(Number.isFinite);
    const meanRT = rts.length ? rts.reduce((s, x) => s + x, 0) / rts.length : null;
    const variance = rts.length && meanRT != null
      ? rts.reduce((s, x) => s + (x - meanRT) ** 2, 0) / rts.length
      : 0;
    const stdevRT = Math.sqrt(variance);
    const sorted = [...rts].sort((a, b) => a - b);
    const medianRT = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
    const maxSpan = attempts.filter((a) => a.success).reduce((m, a) => Math.max(m, a.length), 0);
    const orderErrors = attempts.reduce((s, a) => s + a.orderErrors, 0);
    const summary = {
      totalTrials: total,
      correct,
      maxSpan,
      orderErrors,
      positionErrors: orderErrors,
      metrics: { accuracy, precision: accuracy, recall: accuracy, f1: accuracy, specificity: 1 },
      rt: {
        mean: meanRT, median: medianRT,
        min: sorted[0] ?? null, max: sorted[sorted.length - 1] ?? null,
        stdev: stdevRT, count: rts.length,
      },
    };
    const trials = attempts.map((a, i) => ({ index: i, isTarget: true, responded: a.success, rtMs: a.rtMs }));
    onFinish?.({ config, trials, summary, attempts });
  }, [config, onFinish]);

  // Escape to exit
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onExit?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onExit]);

  const onTap = (blockId) => {
    if (phase !== "recall") return;
    if (removed.has(blockId)) return;
    // Any tap removes the block. Order is compared at submit time.
    setRemoved((prev) => {
      const next = new Set(prev);
      next.add(blockId);
      return next;
    });
    const nextTapped = [...tapped, blockId];
    setTapped(nextTapped);

    // Determine whether this tap was correct at this position (for visual feedback only)
    const expected = expectedOrder(blocks.map((b) => b.id), config.recall);
    const wasCorrect = expected[tapped.length] === blockId;
    setFlashBlock({ id: blockId, ok: wasCorrect });
    setTimeout(() => setFlashBlock(null), 220);

    if (nextTapped.length >= blocks.length) {
      // Auto-submit once user has tapped all blocks
      setTimeout(() => submitRecall(nextTapped), 180);
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
              {phase === "recall" && (config.recall === "backward" ? "tap in reverse order" : "tap in the order shown")}
              {phase === "feedback" && "next"}
            </div>
            <div
              className="relative border border-border bg-input"
              style={{ width: BOARD_SIZE, height: BOARD_SIZE }}
              data-testid="corsi-board"
            >
              {blocks.map((b) => {
                if (removed.has(b.id)) return null;
                const isLit = litIdx === b.id;
                const isFlash = flashBlock?.id === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => onTap(b.id)}
                    disabled={phase !== "recall"}
                    data-testid={`corsi-block-${b.id}`}
                    className="absolute rounded-sm border border-border"
                    style={{
                      left: `${b.x}%`, top: `${b.y}%`,
                      transform: "translate(-50%, -50%)",
                      width: b.blockPx, height: b.blockPx,
                      background: isLit ? "hsl(var(--primary))" : "hsl(var(--card))",
                      boxShadow: isFlash
                        ? (flashBlock.ok ? "inset 0 0 0 3px hsl(var(--chart-3))" : "inset 0 0 0 3px hsl(var(--destructive))")
                        : "none",
                      transition: "background-color 120ms ease-out",
                    }}
                  />
                );
              })}
            </div>
            {phase === "recall" && (
              <div className="text-xs text-muted-foreground metric" data-testid="corsi-progress">
                tapped {tapped.length} / {blocks.length}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
