import React, { useState } from "react";
import { Target, Trash2, Plus, Check } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useApp } from "../lib/store";
import { TASK_LIST } from "../tasks/registry";
import { pct, ms as fms } from "../lib/format";
import { toast } from "sonner";

const METRICS = [
  { key: "accuracy",  label: "Best accuracy",   op: ">=", format: (v) => pct(v/100) },
  { key: "meanRt",    label: "Mean RT below",   op: "<=", format: (v) => fms(v) },
  { key: "nLevel",    label: "N-back N level",  op: ">=", format: (v) => v },
  { key: "maxSpan",   label: "Memory span",     op: ">=", format: (v) => v },
  { key: "sessions",  label: "Sessions count",  op: ">=", format: (v) => v },
];

function evaluateGoal(goal, sessions) {
  const relevant = goal.taskId === "any" ? sessions : sessions.filter((s) => s.taskId === goal.taskId);
  switch (goal.metric) {
    case "accuracy": {
      const best = relevant.reduce((m, s) => Math.max(m, (s.summary?.metrics?.accuracy || 0) * 100), 0);
      return { current: best, achieved: best >= goal.target };
    }
    case "meanRt": {
      const rts = relevant.map((s) => s.summary?.rt?.mean).filter((v) => Number.isFinite(v));
      const best = rts.length ? Math.min(...rts) : Infinity;
      return { current: best === Infinity ? null : best, achieved: best <= goal.target };
    }
    case "nLevel": {
      const best = relevant.filter((s) => s.taskId === "nback").reduce((m, s) => Math.max(m, s.config?.n || 0), 0);
      return { current: best, achieved: best >= goal.target };
    }
    case "maxSpan": {
      const best = relevant.filter((s) => s.taskId === "memorySpan").reduce((m, s) => Math.max(m, s.summary?.maxSpan || 0), 0);
      return { current: best, achieved: best >= goal.target };
    }
    case "sessions": {
      return { current: relevant.length, achieved: relevant.length >= goal.target };
    }
    default: return { current: null, achieved: false };
  }
}

export default function Goals() {
  const { goals, addGoal, deleteGoal, sessions } = useApp();
  const [taskId, setTaskId] = useState("any");
  const [metric, setMetric] = useState("accuracy");
  const [target, setTarget] = useState(80);

  const add = () => {
    const n = Number(target);
    if (!Number.isFinite(n)) { toast.error("Enter a number"); return; }
    addGoal({ taskId, metric, target: n });
    toast.success("Goal set");
  };

  return (
    <div>
      <PageHeader
        eyebrow="goals"
        title="Training Goals"
        description="Set targets and let the app track your progress toward them."
      />
      <div className="p-6 md:p-10 space-y-6">
        <div className="border border-border p-5 rounded-sm bg-card">
          <div className="overline mb-3">new goal</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <Label>Task</Label>
              <Select value={taskId} onValueChange={setTaskId}>
                <SelectTrigger data-testid="goal-task"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any task</SelectItem>
                  {TASK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger data-testid="goal-metric"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRICS.map((m) => <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Target</Label>
              <Input type="number" value={target} onChange={(e) => setTarget(e.target.value)} className="metric" data-testid="goal-target" />
            </div>
            <div className="flex items-end">
              <Button className="w-full" onClick={add} data-testid="goal-add-btn"><Plus className="w-4 h-4 mr-1.5" strokeWidth={1.5} />Add goal</Button>
            </div>
          </div>
        </div>

        {goals.length === 0 ? (
          <EmptyState icon={Target} title="No goals set" description="Create your first goal above to start tracking progress." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g) => {
              const m = METRICS.find((x) => x.key === g.metric);
              const { current, achieved } = evaluateGoal(g, sessions);
              return (
                <div key={g.id} className={`border p-5 rounded-sm bg-card ${achieved ? "border-[hsl(var(--chart-3))]" : "border-border"}`} data-testid={`goal-${g.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="overline">{g.taskId === "any" ? "any task" : g.taskId}</div>
                      <div className="font-display text-lg mt-1">{m?.label} {m?.op} {m?.format(g.target)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {achieved && <Check className="w-4 h-4 text-[hsl(var(--chart-3))]" strokeWidth={1.5} />}
                      <Button size="sm" variant="ghost" onClick={() => deleteGoal(g.id)}><Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /></Button>
                    </div>
                  </div>
                  <div className="mt-3 text-sm">
                    <span className="text-muted-foreground">Current: </span>
                    <span className="metric">{current == null ? "—" : m?.format(current)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
