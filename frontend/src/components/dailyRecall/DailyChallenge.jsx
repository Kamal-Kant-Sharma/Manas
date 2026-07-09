import React, { useEffect, useState } from "react";
import { Brain, Check, RefreshCw, Flame } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  loadRecallState, saveRecallState, ensureTodaysChallenge,
  currentMode, submitRecall, skipToday, DEFAULT_RECALL_CFG, generateChallenge
} from "../../lib/dailyRecall";
import { pct } from "../../lib/format";
import { toast } from "sonner";
import { storage } from "../../lib/storage";

export default function DailyChallenge() {
  const [state, setState] = useState(() => {
    let s = loadRecallState();
    s = ensureTodaysChallenge(s);
    saveRecallState(s);
    return s;
  });
  const [phraseInput, setPhraseInput] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [lastResult, setLastResult] = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgWordCount, setCfgWordCount] = useState(state.cfg?.wordCount ?? 6);
  const [cfgNumberLength, setCfgNumberLength] = useState(state.cfg?.numberLength ?? 8);
  const [cfgCharset, setCfgCharset] = useState(state.cfg?.characterSet ?? "digits");

  useEffect(() => {
    // Keep state fresh with storage
    const onStorage = () => setState(loadRecallState());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const mode = currentMode(state);

  const onSubmit = () => {
    const { entry, state: newState } = submitRecall({ phrase: phraseInput, number: numberInput });
    setState(newState);
    setLastResult(entry);
    setPhraseInput(""); setNumberInput("");
    toast.success(`Recalled — ${pct(entry.overall)} overall`);
  };

  const onNewChallenge = () => {
    const s = skipToday();
    setState(s);
    setLastResult(null);
    toast("New challenge generated");
  };

  const onSaveCfg = () => {
    const cfg = { wordCount: Number(cfgWordCount) || 6, numberLength: Number(cfgNumberLength) || 8, characterSet: cfgCharset };
    const s = { ...state, cfg };
    // Regenerate pending with new settings
    const gen = generateChallenge(cfg, Math.random() * 1e9);
    s.pending = { generatedOn: state.pending.generatedOn, phrase: gen.phrase, number: gen.number, cfg };
    saveRecallState(s);
    setState(s);
    setShowConfig(false);
    toast.success("Settings applied");
  };

  const consistency = state.history.length > 0 ? state.history.filter((h) => h.overall >= 0.5).length / state.history.length : null;

  return (
    <div className="border border-border bg-card rounded-sm relative overflow-hidden" data-testid="daily-recall-card">
      <div className="absolute top-0 left-0 h-0.5 w-full" style={{ background: "hsl(var(--chart-2))" }} />
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-[hsl(var(--chart-2))]" strokeWidth={1.5} />
            <div className="overline">daily delayed recall</div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Flame className="w-3 h-3" strokeWidth={1.5} /> <span className="metric text-foreground" data-testid="recall-streak">{state.streak}</span></span>
            <span>·</span>
            <span>best <span className="metric text-foreground" data-testid="recall-longest">{state.longestStreak}</span></span>
          </div>
        </div>

        {mode === "recall" && (
          <div className="mt-5" data-testid="recall-mode">
            <div className="font-display text-xl">Recall yesterday's challenge</div>
            <div className="text-xs text-muted-foreground mt-1">Enter what you remember. We'll show the answer after you submit.</div>
            <div className="mt-4 space-y-3 max-w-2xl">
              <div>
                <Label className="text-xs">Phrase</Label>
                <Input value={phraseInput} onChange={(e) => setPhraseInput(e.target.value)} placeholder="the ..." data-testid="recall-phrase-input" />
              </div>
              <div>
                <Label className="text-xs">Number</Label>
                <Input value={numberInput} onChange={(e) => setNumberInput(e.target.value)} placeholder="digits…" className="metric" data-testid="recall-number-input" />
              </div>
              <div className="flex gap-2">
                <Button onClick={onSubmit} data-testid="recall-submit-btn"><Check className="w-4 h-4 mr-1.5" strokeWidth={1.5} />Submit</Button>
                <Button variant="outline" onClick={() => {
                  // Skip — treat as blank recall
                  const { entry, state: newState } = submitRecall({ phrase: "", number: "" });
                  setState(newState); setLastResult(entry); toast("Skipped — 0% recorded");
                }} data-testid="recall-skip-btn">Skip / can't remember</Button>
              </div>
            </div>
          </div>
        )}

        {lastResult && (
          <div className="mt-5 border-t border-border pt-4" data-testid="recall-result">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <MiniStat label="Overall" value={pct(lastResult.overall)} />
              <MiniStat label="Phrase words" value={pct(lastResult.phraseWordAccuracy)} />
              <MiniStat label="Phrase chars" value={pct(lastResult.phraseCharAccuracy)} />
              <MiniStat label="Number chars" value={pct(lastResult.numberCharAccuracy)} />
            </div>
            <div className="text-xs text-muted-foreground">Correct phrase:</div>
            <div className="font-display italic mt-1">"{lastResult.phrase}"</div>
            <div className="text-xs text-muted-foreground mt-3">Correct number:</div>
            <div className="metric text-lg mt-1">{lastResult.number}</div>
          </div>
        )}

        {mode !== "recall" && state.pending && (
          <div className="mt-5" data-testid="memorize-mode">
            <div className="font-display text-xl">Memorize for tomorrow</div>
            <div className="text-xs text-muted-foreground mt-1">Read carefully — you'll be asked to recall this on your next visit.</div>
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="border border-border rounded-sm p-4 bg-input">
                <div className="overline mb-2">phrase</div>
                <div className="font-display text-lg leading-snug" data-testid="memorize-phrase">"{state.pending.phrase}"</div>
              </div>
              <div className="border border-border rounded-sm p-4 bg-input">
                <div className="overline mb-2">number</div>
                <div className="metric text-2xl md:text-3xl break-all" data-testid="memorize-number">{state.pending.number}</div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onNewChallenge} data-testid="new-challenge-btn"><RefreshCw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />New challenge</Button>
              <Button variant="ghost" size="sm" onClick={() => setShowConfig((v) => !v)} data-testid="recall-config-toggle">Settings</Button>
            </div>

            {showConfig && (
              <div className="mt-4 border border-border rounded-sm p-4 bg-input space-y-3" data-testid="recall-config">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Approx. word count</Label>
                    <Input type="number" min={3} max={12} value={cfgWordCount} onChange={(e) => setCfgWordCount(e.target.value)} className="metric" data-testid="cfg-word-count" />
                  </div>
                  <div>
                    <Label className="text-xs">Number length</Label>
                    <Input type="number" min={4} max={20} value={cfgNumberLength} onChange={(e) => setCfgNumberLength(e.target.value)} className="metric" data-testid="cfg-number-length" />
                  </div>
                  <div>
                    <Label className="text-xs">Character set</Label>
                    <select value={cfgCharset} onChange={(e) => setCfgCharset(e.target.value)} className="w-full h-9 border border-border rounded-sm bg-input px-2 text-sm" data-testid="cfg-charset">
                      <option value="digits">Digits only</option>
                      <option value="alphanumeric">Alphanumeric</option>
                    </select>
                  </div>
                </div>
                <Button size="sm" onClick={onSaveCfg} data-testid="recall-cfg-save">Apply & regenerate</Button>
              </div>
            )}
          </div>
        )}

        {state.history.length > 0 && (
          <div className="mt-5 border-t border-border pt-4">
            <div className="flex items-baseline justify-between mb-2">
              <div className="overline">recall history · last {Math.min(14, state.history.length)}</div>
              <div className="text-xs text-muted-foreground">consistency <span className="metric text-foreground">{consistency == null ? "—" : pct(consistency)}</span></div>
            </div>
            <div className="flex gap-1 flex-wrap" data-testid="recall-heatmap">
              {state.history.slice(0, 14).reverse().map((h, i) => (
                <div
                  key={i}
                  title={`${h.date}: ${pct(h.overall)}`}
                  className="w-5 h-5 rounded-sm border border-border"
                  style={{ background: `hsl(var(--chart-3) / ${Math.max(0.15, h.overall)})` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="border border-border rounded-sm p-2 bg-input">
      <div className="overline">{label}</div>
      <div className="metric text-base mt-0.5">{value}</div>
    </div>
  );
}
