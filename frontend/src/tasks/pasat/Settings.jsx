import React from "react";
import { DEFAULT_PASAT, PASAT_OPS } from "./module";
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

export default function PASATSettings({ value, onChange }) {
  const v = { ...DEFAULT_PASAT, ...value };
  const set = (patch) => onChange({ ...v, ...patch });
  const toggleOp = (key) => {
    const has = v.operations.includes(key);
    const ops = has ? v.operations.filter((o) => o !== key) : [...v.operations, key];
    onChange({ ...v, operations: ops.length ? ops : [key] });
  };

  return (
    <div className="space-y-6" data-testid="pasat-settings">
      <section>
        <div className="overline mb-2">core</div>
        <Row label="Rounds"><Input type="number" min={5} max={500} value={v.rounds} onChange={(e) => set({ rounds: Math.max(5, Number(e.target.value) || 5) })} className="metric" data-testid="pasat-cfg-rounds" /></Row>
        <Row label="Interval (ms)" hint="Time between number presentations">
          <Input type="number" min={500} max={10000} step={100} value={v.intervalMs} onChange={(e) => set({ intervalMs: Number(e.target.value) || 2400 })} className="metric" data-testid="pasat-cfg-interval" />
        </Row>
        <Row label="Operation window" hint="How many recent numbers to combine (2 = classic PASAT)">
          <Input type="number" min={2} max={8} value={v.windowSize ?? 2} onChange={(e) => set({ windowSize: Math.max(2, Math.min(8, Number(e.target.value) || 2)) })} className="metric" data-testid="pasat-cfg-window" />
        </Row>
      </section>

      <section>
        <div className="overline mb-2">presentation</div>
        <Row label="Audio"><Switch checked={v.audio} onCheckedChange={(on) => set({ audio: on })} /></Row>
        <Row label="Visual"><Switch checked={v.visual} onCheckedChange={(on) => set({ visual: on })} /></Row>
      </section>

      <section>
        <div className="overline mb-2">numbers</div>
        <Row label="Range">
          <div className="flex items-center gap-2">
            <Input type="number" value={v.minNumber} onChange={(e) => set({ minNumber: Number(e.target.value) })} className="metric w-20" />
            <span className="text-muted-foreground">to</span>
            <Input type="number" value={v.maxNumber} onChange={(e) => set({ maxNumber: Number(e.target.value) })} className="metric w-20" />
          </div>
        </Row>
        <Row label="Allow negatives"><Switch checked={v.allowNegatives} onCheckedChange={(on) => set({ allowNegatives: on })} /></Row>
        <Row label="Decimals"><Switch checked={v.decimals} onCheckedChange={(on) => set({ decimals: on })} /></Row>
      </section>

      <section>
        <div className="overline mb-2">operations</div>
        <Row label="Mode">
          <Select value={v.operationMode} onValueChange={(m) => set({ operationMode: m })}>
            <SelectTrigger data-testid="pasat-cfg-op-mode"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="single">Single</SelectItem>
              <SelectItem value="alternating">Alternating</SelectItem>
              <SelectItem value="random">Random</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <div className="pt-2 grid grid-cols-3 gap-2">
          {PASAT_OPS.map((op) => {
            const on = v.operations.includes(op.key);
            return (
              <button
                key={op.key}
                onClick={() => toggleOp(op.key)}
                className={`px-3 py-2 rounded-sm border text-left ${on ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                data-testid={`pasat-cfg-op-${op.key}`}
                style={{ transitionProperty: "background-color, border-color, color", transitionDuration: "150ms" }}
              >
                <div className="metric text-lg">{op.symbol}</div>
                <div className="text-xs">{op.label}</div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
