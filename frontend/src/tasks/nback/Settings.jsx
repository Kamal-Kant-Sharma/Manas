import React from "react";
import { NBACK_STREAMS, DEFAULT_NBACK } from "./module";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Slider } from "../../components/ui/slider";

function Row({ label, hint, children }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 py-3 border-b border-border">
      <div>
        <Label className="text-sm">{label}</Label>
        {hint && <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>}
      </div>
      <div className="md:w-72 flex-shrink-0">{children}</div>
    </div>
  );
}

export default function NBackSettings({ value, onChange }) {
  const v = { ...DEFAULT_NBACK, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const setStream = (key, on) => onChange({ ...v, streams: { ...v.streams, [key]: on } });

  return (
    <div className="space-y-6" data-testid="nback-settings">
      <section>
        <div className="overline mb-2">core</div>
        <Row label="N level" hint="How many steps back to compare">
          <Input
            type="number"
            min={1}
            max={12}
            value={v.n}
            onChange={(e) => set({ n: Math.max(1, Number(e.target.value) || 1) })}
            className="metric"
            data-testid="nback-cfg-n"
          />
        </Row>
        <Row label="Rounds" hint="Total trials in the session">
          <Input
            type="number"
            min={5}
            max={500}
            value={v.rounds}
            onChange={(e) => set({ rounds: Math.max(5, Number(e.target.value) || 5) })}
            className="metric"
            data-testid="nback-cfg-rounds"
          />
        </Row>
        <Row label="Warm-up trials" hint="Not scored; lets sequence fill up">
          <Input type="number" min={0} max={20} value={v.warmup} onChange={(e) => set({ warmup: Math.max(0, Number(e.target.value) || 0) })} className="metric" />
        </Row>
        <Row label="Target probability" hint="Chance any given stream is a target">
          <div className="flex items-center gap-3">
            <Slider value={[Math.round(v.targetProbability * 100)]} min={5} max={60} step={1} onValueChange={([p]) => set({ targetProbability: p / 100 })} data-testid="nback-cfg-prob" />
            <span className="metric text-xs w-10 text-right">{Math.round(v.targetProbability * 100)}%</span>
          </div>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">timing (ms)</div>
        <Row label="Stimulus duration">
          <Input type="number" min={100} max={5000} step={50} value={v.stimulusMs} onChange={(e) => set({ stimulusMs: Number(e.target.value) || 500 })} className="metric" data-testid="nback-cfg-stim-ms" />
        </Row>
        <Row label="Inter-stimulus interval">
          <Input type="number" min={100} max={10000} step={50} value={v.isiMs} onChange={(e) => set({ isiMs: Number(e.target.value) || 2000 })} className="metric" data-testid="nback-cfg-isi-ms" />
        </Row>
        <Row label="Reaction window">
          <Input type="number" min={200} max={10000} step={50} value={v.reactionWindowMs} onChange={(e) => set({ reactionWindowMs: Number(e.target.value) || 2200 })} className="metric" />
        </Row>
      </section>

      <section>
        <div className="overline mb-2">grid</div>
        <Row label="Grid size" hint="Applies when position stream enabled">
          <div className="flex items-center gap-3">
            <Slider value={[v.gridSize]} min={3} max={9} step={1} onValueChange={([g]) => set({ gridSize: g })} data-testid="nback-cfg-grid" />
            <span className="metric text-xs w-10 text-right">{v.gridSize}×{v.gridSize}</span>
          </div>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">streams</div>
        {NBACK_STREAMS.map((s) => (
          <div key={s.key} className="flex items-center justify-between py-2 border-b border-border">
            <div>
              <div className="text-sm">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.type} · hotkey <span className="metric">{s.hotkey.toUpperCase()}</span></div>
            </div>
            <Switch checked={!!v.streams[s.key]} onCheckedChange={(on) => setStream(s.key, on)} data-testid={`nback-cfg-stream-${s.key}`} />
          </div>
        ))}
      </section>

      <section>
        <div className="overline mb-2">audio</div>
        <Row label="Speech rate">
          <div className="flex items-center gap-3">
            <Slider value={[Math.round((v.audioRate ?? 1) * 100)]} min={50} max={200} step={5} onValueChange={([r]) => set({ audioRate: r / 100 })} />
            <span className="metric text-xs w-10 text-right">{(v.audioRate ?? 1).toFixed(2)}</span>
          </div>
        </Row>
        <Row label="Pitch">
          <div className="flex items-center gap-3">
            <Slider value={[Math.round((v.audioPitch ?? 1) * 100)]} min={50} max={200} step={5} onValueChange={([r]) => set({ audioPitch: r / 100 })} />
            <span className="metric text-xs w-10 text-right">{(v.audioPitch ?? 1).toFixed(2)}</span>
          </div>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">mode</div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <Label>Adaptive difficulty</Label>
          <Switch checked={!!v.adaptive} onCheckedChange={(on) => set({ adaptive: on })} />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <Label>Practice (not saved)</Label>
          <Switch checked={!!v.practice} onCheckedChange={(on) => set({ practice: on })} />
        </div>
      </section>
    </div>
  );
}
