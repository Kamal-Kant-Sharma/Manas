import React from "react";
import { DEFAULT_OSPAN } from "./module";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
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

export default function OSPANSettings({ value, onChange }) {
  const v = { ...DEFAULT_OSPAN, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const toggleDistractor = (key) => {
    const has = v.distractorTypes.includes(key);
    const next = has ? v.distractorTypes.filter((x) => x !== key) : [...v.distractorTypes, key];
    onChange({ ...v, distractorTypes: next.length ? next : [key] });
  };

  return (
    <div className="space-y-6" data-testid="ospan-settings">
      <section>
        <div className="overline mb-2">items to memorize</div>
        <Row label="Item type">
          <Select value={v.itemType} onValueChange={(x) => set({ itemType: x })}>
            <SelectTrigger data-testid="ospan-cfg-item"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="letters">Letters</SelectItem>
              <SelectItem value="numbers">Numbers</SelectItem>
              <SelectItem value="words">Words</SelectItem>
              <SelectItem value="colors">Colors</SelectItem>
              <SelectItem value="shapes">Shapes</SelectItem>
              <SelectItem value="symbols">Symbols</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Recall mode">
          <Select value={v.recall} onValueChange={(x) => set({ recall: x })}>
            <SelectTrigger data-testid="ospan-cfg-recall"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="forward">Forward</SelectItem>
              <SelectItem value="backward">Backward</SelectItem>
              <SelectItem value="ascending">Ascending</SelectItem>
              <SelectItem value="descending">Descending</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
              <SelectItem value="random">Random order (set match)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">distractor</div>
        <div className="pt-2 grid grid-cols-2 gap-2 mb-3">
          {[
            { key: "arithmetic", label: "Mental arithmetic" },
            { key: "spatial", label: "Spatial reasoning" },
          ].map((d) => {
            const on = v.distractorTypes.includes(d.key);
            return (
              <button
                key={d.key}
                onClick={() => toggleDistractor(d.key)}
                className={`px-3 py-3 rounded-sm border text-left ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                data-testid={`ospan-cfg-distractor-${d.key}`}
                style={{ transitionProperty: "background-color, border-color, color", transitionDuration: "150ms" }}
              >
                <div className="font-display text-sm">{d.label}</div>
                <div className="text-xs mt-1">{on ? "enabled" : "disabled"}</div>
              </button>
            );
          })}
        </div>
        <Row label="Arithmetic difficulty">
          <Select value={v.arithmeticDifficulty} onValueChange={(x) => set({ arithmeticDifficulty: x })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="easy">Easy (+, −, small)</SelectItem>
              <SelectItem value="medium">Medium (+ − × ÷, moderate)</SelectItem>
              <SelectItem value="hard">Hard (larger operands)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Distractor time (ms)"><Input type="number" min={1000} max={15000} step={100} value={v.distractorMs} onChange={(e) => set({ distractorMs: Number(e.target.value) || 4000 })} className="metric" /></Row>
      </section>

      <section>
        <div className="overline mb-2">difficulty</div>
        <Row label="Start length"><Input type="number" min={2} max={20} value={v.startLength} onChange={(e) => set({ startLength: Number(e.target.value) || 3 })} className="metric" data-testid="ospan-cfg-start" /></Row>
        <Row label="Max length"><Input type="number" min={3} max={30} value={v.maxLength} onChange={(e) => set({ maxLength: Number(e.target.value) || 8 })} className="metric" data-testid="ospan-cfg-max" /></Row>
        <Row label="Failures allowed per length"><Input type="number" min={1} max={5} value={v.trialsPerLength} onChange={(e) => set({ trialsPerLength: Number(e.target.value) || 1 })} className="metric" /></Row>
        <Row label="Adaptive length"><Switch checked={v.adaptive} onCheckedChange={(on) => set({ adaptive: on })} /></Row>
      </section>

      <section>
        <div className="overline mb-2">timing</div>
        <Row label="Item presentation (ms)"><Input type="number" min={200} max={5000} step={50} value={v.presentationMs} onChange={(e) => set({ presentationMs: Number(e.target.value) || 900 })} className="metric" /></Row>
        <Row label="Gap between items (ms)"><Input type="number" min={0} max={2000} step={50} value={v.gapMs} onChange={(e) => set({ gapMs: Number(e.target.value) || 300 })} className="metric" /></Row>
      </section>
    </div>
  );
}
