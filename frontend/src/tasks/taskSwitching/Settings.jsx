import React from "react";
import { DEFAULT_TASK_SWITCHING, TS_TASK_TYPES, getTaskType } from "./module";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Slider } from "../../components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";

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

const QUAD_NAMES = ["Top Left", "Top Right", "Bottom Left", "Bottom Right"];

export default function TaskSwitchingSettings({ value, onChange }) {
  const v = { ...DEFAULT_TASK_SWITCHING, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const setQuadrant = (i, patch) => {
    const next = v.quadrants.slice();
    next[i] = { ...next[i], ...patch };
    onChange({ ...v, quadrants: next });
  };
  const setQuadrantType = (i, type) => {
    const tt = getTaskType(type);
    const nextParams = tt?.params ? { ...tt.params } : {};
    setQuadrant(i, { type, params: nextParams });
  };

  return (
    <div className="space-y-6" data-testid="ts-settings">
      <section>
        <div className="overline mb-2">quadrant rules</div>
        {v.quadrants.map((q, i) => {
          const tt = getTaskType(q.type);
          return (
            <div key={i} className="py-3 border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-sm">{QUAD_NAMES[i]}</Label>
                <Select value={q.type} onValueChange={(t) => setQuadrantType(i, t)}>
                  <SelectTrigger className="w-64" data-testid={`ts-cfg-quadrant-${i}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TS_TASK_TYPES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {tt?.params && Object.keys(tt.params).map((paramKey) => (
                <div key={paramKey} className="mt-2 flex items-center gap-2">
                  <div className="text-xs text-muted-foreground w-28">{paramKey}</div>
                  <Input
                    type="number"
                    value={q.params?.[paramKey] ?? tt.params[paramKey]}
                    onChange={(e) => setQuadrant(i, { params: { ...q.params, [paramKey]: Number(e.target.value) } })}
                    className="metric w-32"
                    data-testid={`ts-cfg-param-${i}-${paramKey}`}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section>
        <div className="overline mb-2">core</div>
        <Row label="Rounds">
          <Input type="number" min={5} max={500} value={v.rounds} onChange={(e) => set({ rounds: Math.max(5, Number(e.target.value) || 5) })} className="metric" data-testid="ts-cfg-rounds" />
        </Row>
        <Row label="Switch probability" hint="Chance next trial has a different quadrant/rule">
          <div className="flex items-center gap-3">
            <Slider value={[Math.round(v.switchProbability * 100)]} min={0} max={100} step={5} onValueChange={([p]) => set({ switchProbability: p / 100 })} data-testid="ts-cfg-switch-prob" />
            <span className="metric text-xs w-10 text-right">{Math.round(v.switchProbability * 100)}%</span>
          </div>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">timing (ms)</div>
        <Row label="Stimulus duration"><Input type="number" min={200} max={5000} step={50} value={v.stimulusMs} onChange={(e) => set({ stimulusMs: Number(e.target.value) || 1500 })} className="metric" /></Row>
        <Row label="Inter-stimulus interval"><Input type="number" min={100} max={5000} step={50} value={v.isiMs} onChange={(e) => set({ isiMs: Number(e.target.value) || 400 })} className="metric" /></Row>
        <Row label="Reaction window"><Input type="number" min={200} max={5000} step={50} value={v.reactionWindowMs} onChange={(e) => set({ reactionWindowMs: Number(e.target.value) || 2500 })} className="metric" /></Row>
      </section>

      <section>
        <div className="overline mb-2">stimulus pool</div>
        <Row label="Number range">
          <div className="flex items-center gap-2">
            <Input type="number" value={v.minNumber} onChange={(e) => set({ minNumber: Number(e.target.value) })} className="metric w-20" />
            <span className="text-muted-foreground">to</span>
            <Input type="number" value={v.maxNumber} onChange={(e) => set({ maxNumber: Number(e.target.value) })} className="metric w-20" />
          </div>
        </Row>
        <Row label="Allow negatives"><Switch checked={v.allowNegatives} onCheckedChange={(on) => set({ allowNegatives: on })} /></Row>
        <Row label="Mixed case letters"><Switch checked={v.mixedCase} onCheckedChange={(on) => set({ mixedCase: on })} /></Row>
        <Row label="Use colors (font + BG)" hint="Enable for color-based rules"><Switch checked={v.useColor} onCheckedChange={(on) => set({ useColor: on })} /></Row>
      </section>
    </div>
  );
}
