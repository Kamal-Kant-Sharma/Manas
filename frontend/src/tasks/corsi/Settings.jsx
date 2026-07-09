import React from "react";
import { DEFAULT_CORSI } from "./module";
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

export default function CorsiSettings({ value, onChange }) {
  const v = { ...DEFAULT_CORSI, ...value };
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="space-y-6" data-testid="corsi-settings">
      <section>
        <div className="overline mb-2">board</div>
        <Row label="Number of blocks">
          <Input type="number" min={4} max={16} value={v.blocks} onChange={(e) => set({ blocks: Math.max(4, Number(e.target.value) || 9) })} className="metric" data-testid="corsi-cfg-blocks" />
        </Row>
        <Row label="Layout">
          <Select value={v.layout} onValueChange={(x) => set({ layout: x })}>
            <SelectTrigger data-testid="corsi-cfg-layout"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="classic">Classic (scatter, 9 blocks)</SelectItem>
              <SelectItem value="grid">Grid (rows × cols)</SelectItem>
              <SelectItem value="random">Random (non-overlapping)</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">recall</div>
        <Row label="Recall mode">
          <Select value={v.recall} onValueChange={(x) => set({ recall: x })}>
            <SelectTrigger data-testid="corsi-cfg-recall"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="forward">Forward</SelectItem>
              <SelectItem value="backward">Backward</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">difficulty</div>
        <Row label="Start length"><Input type="number" min={2} max={20} value={v.startLength} onChange={(e) => set({ startLength: Number(e.target.value) || 3 })} className="metric" /></Row>
        <Row label="Max length"><Input type="number" min={3} max={20} value={v.maxLength} onChange={(e) => set({ maxLength: Number(e.target.value) || 12 })} className="metric" /></Row>
        <Row label="Failures allowed per length"><Input type="number" min={1} max={5} value={v.trialsPerLength} onChange={(e) => set({ trialsPerLength: Number(e.target.value) || 2 })} className="metric" /></Row>
        <Row label="Adaptive length"><Switch checked={v.adaptive} onCheckedChange={(on) => set({ adaptive: on })} /></Row>
      </section>

      <section>
        <div className="overline mb-2">timing (ms)</div>
        <Row label="Block presentation"><Input type="number" min={200} max={2000} step={50} value={v.presentationMs} onChange={(e) => set({ presentationMs: Number(e.target.value) || 700 })} className="metric" /></Row>
        <Row label="Gap between blocks"><Input type="number" min={100} max={1500} step={50} value={v.gapMs} onChange={(e) => set({ gapMs: Number(e.target.value) || 300 })} className="metric" /></Row>
        <Row label="Recall time limit"><Input type="number" min={2000} max={60000} step={500} value={v.recallTimeoutMs} onChange={(e) => set({ recallTimeoutMs: Number(e.target.value) || 15000 })} className="metric" /></Row>
      </section>
    </div>
  );
}
