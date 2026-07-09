import React from "react";
import { DEFAULT_MEMORY_SPAN } from "./module";
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

export default function MemorySpanSettings({ value, onChange }) {
  const v = { ...DEFAULT_MEMORY_SPAN, ...value };
  const set = (patch) => onChange({ ...v, ...patch });

  return (
    <div className="space-y-6" data-testid="memory-settings">
      <section>
        <div className="overline mb-2">stimulus</div>
        <Row label="Type">
          <Select value={v.stimulus} onValueChange={(x) => set({ stimulus: x })}>
            <SelectTrigger data-testid="memory-cfg-stimulus"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="digits">Digits</SelectItem>
              <SelectItem value="letters">Letters</SelectItem>
              <SelectItem value="words">Words</SelectItem>
              <SelectItem value="colors">Colors</SelectItem>
              <SelectItem value="shapes">Shapes</SelectItem>
              <SelectItem value="positions">Positions (3x3)</SelectItem>
              <SelectItem value="audio-digits">Audio Digits</SelectItem>
              <SelectItem value="audio-letters">Audio Letters</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row label="Recall mode">
          <Select value={v.recall} onValueChange={(x) => set({ recall: x })}>
            <SelectTrigger data-testid="memory-cfg-recall"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="forward">Forward</SelectItem>
              <SelectItem value="backward">Backward</SelectItem>
              <SelectItem value="ascending">Ascending</SelectItem>
              <SelectItem value="descending">Descending</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
            </SelectContent>
          </Select>
        </Row>
      </section>

      <section>
        <div className="overline mb-2">difficulty</div>
        <Row label="Start length"><Input type="number" min={2} max={20} value={v.startLength} onChange={(e) => set({ startLength: Number(e.target.value) || 3 })} className="metric" /></Row>
        <Row label="Max length"><Input type="number" min={3} max={30} value={v.maxLength} onChange={(e) => set({ maxLength: Number(e.target.value) || 12 })} className="metric" /></Row>
        <Row label="Failures allowed per length" hint="After this many failures we stop">
          <Input type="number" min={1} max={5} value={v.trialsPerLength} onChange={(e) => set({ trialsPerLength: Number(e.target.value) || 2 })} className="metric" />
        </Row>
        <Row label="Adaptive length"><Switch checked={v.adaptive} onCheckedChange={(on) => set({ adaptive: on })} /></Row>
      </section>

      <section>
        <div className="overline mb-2">timing</div>
        <Row label="Presentation (ms per item)"><Input type="number" min={100} max={5000} step={50} value={v.presentationMs} onChange={(e) => set({ presentationMs: Number(e.target.value) || 800 })} className="metric" /></Row>
        <Row label="Gap between items (ms)"><Input type="number" min={0} max={2000} step={50} value={v.gapMs} onChange={(e) => set({ gapMs: Number(e.target.value) || 300 })} className="metric" /></Row>
      </section>
    </div>
  );
}
