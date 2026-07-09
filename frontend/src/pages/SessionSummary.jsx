import React from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from "recharts";
import { getTask } from "../tasks/registry";
import { Button } from "../components/ui/button";
import { pct, ms as fms, int, num } from "../lib/format";
import { rollingAverage } from "../lib/stats";
import PageHeader from "../components/common/PageHeader";

const CHART_COLORS = ["#7aa2f7", "#bb9af7", "#9ece6a", "#e0af68", "#f7768e", "#7dcfff", "#ff9e64"];

function chartTooltipStyle() {
  return {
    contentStyle: {
      background: "#24283b",
      border: "1px solid #414868",
      borderRadius: 2,
      color: "#c0caf5",
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 12,
    },
    cursor: { stroke: "#414868", strokeWidth: 1 },
  };
}

export default function SessionSummary({ session, onDone, onRepeat }) {
  const nav = useNavigate();
  const task = getTask(session.taskId);
  const s = session.summary || {};
  const rt = s.rt || {};

  // RT histogram
  const rtBins = React.useMemo(() => {
    const trials = session.trials || [];
    const rts = trials.filter((t) => t.responded && Number.isFinite(t.rtMs)).map((t) => t.rtMs);
    if (!rts.length) return [];
    const min = Math.min(...rts);
    const max = Math.max(...rts);
    const bins = 10;
    const step = Math.max(1, (max - min) / bins);
    const buckets = Array.from({ length: bins }, (_, i) => ({
      x: Math.round(min + step * i),
      count: 0,
    }));
    for (const v of rts) {
      const i = Math.min(bins - 1, Math.floor((v - min) / step));
      buckets[i].count++;
    }
    return buckets;
  }, [session.trials]);

  // Rolling accuracy per trial
  const rollingAcc = React.useMemo(() => {
    const trials = (session.trials || []).filter((t) => !t.isWarmup);
    const flags = trials.map((t) => {
      const c = (t.isTarget && t.responded) || (!t.isTarget && !t.responded);
      return c ? 1 : 0;
    });
    return rollingAverage(flags, 5).map((v, i) => ({ i: i + 1, accuracy: v }));
  }, [session.trials]);

  // Per-stream radar (n-back)
  const perStreamRadar = React.useMemo(() => {
    if (!s.perStream) return [];
    return Object.entries(s.perStream).map(([k, v]) => ({
      stream: k,
      accuracy: (v.metrics.accuracy || 0) * 100,
      precision: (v.metrics.precision || 0) * 100,
      recall: (v.metrics.recall || 0) * 100,
    }));
  }, [s.perStream]);

  return (
    <div>
      <PageHeader
        eyebrow={`session complete · ${task?.name}`}
        title="Session Summary"
        description={task?.describeConfig(session.config)}
        actions={
          <>
            <Button variant="outline" onClick={onRepeat} data-testid="repeat-btn">Run again</Button>
            <Button onClick={onDone} data-testid="done-btn">Done</Button>
          </>
        }
      />
      <div className="p-6 md:p-10 space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Kpi label="Accuracy" value={pct(s.metrics?.accuracy)} accent="text-[hsl(var(--chart-3))]" testId="sum-accuracy" />
          <Kpi label="F1" value={num(s.metrics?.f1, 3)} testId="sum-f1" />
          <Kpi label="Precision" value={pct(s.metrics?.precision)} testId="sum-precision" />
          <Kpi label="Recall" value={pct(s.metrics?.recall)} testId="sum-recall" />
          <Kpi label="Mean RT" value={fms(rt.mean)} testId="sum-rt-mean" />
          <Kpi label="Median RT" value={fms(rt.median)} testId="sum-rt-median" />
          <Kpi label="Fastest RT" value={fms(rt.min)} testId="sum-rt-min" />
          <Kpi label="RT σ" value={fms(rt.stdev)} testId="sum-rt-stdev" />
        </div>

        {/* Confusion matrix */}
        {s.confusion && (
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="overline mb-3">confusion matrix</div>
            <div className="grid grid-cols-2 gap-2 max-w-md">
              <MatrixCell label="True Positive" value={s.confusion.TP} accent="hsl(var(--chart-3))" />
              <MatrixCell label="False Positive" value={s.confusion.FP} accent="hsl(var(--destructive))" />
              <MatrixCell label="False Negative" value={s.confusion.FN} accent="hsl(var(--destructive))" />
              <MatrixCell label="True Negative" value={s.confusion.TN} accent="hsl(var(--muted-foreground))" />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Rolling accuracy */}
          {rollingAcc.length > 0 && (
            <div className="border border-border p-5 rounded-sm bg-card">
              <div className="overline mb-3">rolling accuracy · window=5</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={rollingAcc}>
                    <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                    <XAxis dataKey="i" stroke="#9aa5ce" fontSize={10} />
                    <YAxis domain={[0, 1]} stroke="#9aa5ce" fontSize={10} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
                    <Tooltip {...chartTooltipStyle()} formatter={(v) => `${Math.round(v * 100)}%`} />
                    <Line type="monotone" dataKey="accuracy" stroke="#7aa2f7" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* RT histogram */}
          {rtBins.length > 0 && (
            <div className="border border-border p-5 rounded-sm bg-card">
              <div className="overline mb-3">reaction time distribution</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <BarChart data={rtBins}>
                    <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                    <XAxis dataKey="x" stroke="#9aa5ce" fontSize={10} tickFormatter={(v) => `${v}ms`} />
                    <YAxis stroke="#9aa5ce" fontSize={10} />
                    <Tooltip {...chartTooltipStyle()} />
                    <Bar dataKey="count" fill="#bb9af7" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-stream radar */}
          {perStreamRadar.length > 0 && (
            <div className="border border-border p-5 rounded-sm bg-card lg:col-span-2">
              <div className="overline mb-3">per-stream performance</div>
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <RadarChart data={perStreamRadar}>
                    <PolarGrid stroke="#414868" />
                    <PolarAngleAxis dataKey="stream" stroke="#9aa5ce" fontSize={11} />
                    <PolarRadiusAxis stroke="#9aa5ce" fontSize={10} angle={30} domain={[0, 100]} />
                    <Radar name="Accuracy" dataKey="accuracy" stroke="#7aa2f7" fill="#7aa2f7" fillOpacity={0.35} />
                    <Radar name="Recall" dataKey="recall" stroke="#9ece6a" fill="#9ece6a" fillOpacity={0.2} />
                    <Tooltip {...chartTooltipStyle()} formatter={(v) => `${Math.round(v)}%`} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* PASAT per-operation */}
        {s.perOperation && (
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="overline mb-3">per-operation accuracy</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(s.perOperation).map(([k, v]) => (
                <div key={k} className="border border-border rounded-sm p-3">
                  <div className="text-xs text-muted-foreground">{k}</div>
                  <div className="metric text-xl">{v.total ? pct(v.correct / v.total) : "—"}</div>
                  <div className="text-xs text-muted-foreground">{v.correct}/{v.total}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Memory span extra */}
        {Number.isFinite(s.maxSpan) && (
          <div className="border border-border p-5 rounded-sm bg-card grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="overline mb-3">max span</div>
              <div className="metric text-5xl">{s.maxSpan}</div>
              <div className="text-xs text-muted-foreground mt-1">Longest successful sequence</div>
            </div>
            {Number.isFinite(s.absoluteSpan) && (
              <div>
                <div className="overline mb-3">absolute span</div>
                <div className="metric text-5xl">{s.absoluteSpan}</div>
                <div className="text-xs text-muted-foreground mt-1">Σ lengths of perfect trials</div>
              </div>
            )}
            {Number.isFinite(s.partialSpan) && (
              <div>
                <div className="overline mb-3">partial span</div>
                <div className="metric text-5xl">{s.partialSpan}</div>
                <div className="text-xs text-muted-foreground mt-1">Σ correct items across attempts</div>
              </div>
            )}
          </div>
        )}

        {/* OSPAN memory vs distractor breakdown */}
        {Number.isFinite(s.memoryAccuracy) && Number.isFinite(s.distractorAccuracy) && (
          <div className="border border-border p-5 rounded-sm bg-card" data-testid="ospan-breakdown">
            <div className="overline mb-3">memory vs distractor</div>
            <div className="grid grid-cols-3 gap-4">
              <div><div className="text-xs text-muted-foreground">Memory only</div><div className="metric text-2xl mt-1 text-[hsl(var(--chart-2))]">{pct(s.memoryAccuracy)}</div></div>
              <div><div className="text-xs text-muted-foreground">Distractor only</div><div className="metric text-2xl mt-1 text-[hsl(var(--chart-4))]">{pct(s.distractorAccuracy)}</div></div>
              <div><div className="text-xs text-muted-foreground">Combined</div><div className="metric text-2xl mt-1 text-[hsl(var(--chart-3))]">{pct(s.combinedScore)}</div></div>
            </div>
          </div>
        )}

        {/* Task-Switching switch cost */}
        {Number.isFinite(s.switchCostMs) && (
          <div className="border border-border p-5 rounded-sm bg-card" data-testid="ts-switch-cost">
            <div className="overline mb-3">switch cost</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><div className="text-xs text-muted-foreground">Switch cost</div><div className="metric text-2xl mt-1" style={{ color: s.switchCostMs > 0 ? "hsl(var(--destructive))" : "hsl(var(--chart-3))" }}>{fms(s.switchCostMs)}</div></div>
              <div><div className="text-xs text-muted-foreground">Switch RT (mean)</div><div className="metric text-2xl mt-1">{fms(s.meanSwitchRT)}</div></div>
              <div><div className="text-xs text-muted-foreground">Repeat RT (mean)</div><div className="metric text-2xl mt-1">{fms(s.meanRepeatRT)}</div></div>
              <div><div className="text-xs text-muted-foreground">Switch / Repeat trials</div><div className="metric text-2xl mt-1">{s.switchTrials}/{s.repeatTrials}</div></div>
              <div><div className="text-xs text-muted-foreground">Switch accuracy</div><div className="metric text-lg mt-1">{pct(s.switchAccuracy)}</div></div>
              <div><div className="text-xs text-muted-foreground">Repeat accuracy</div><div className="metric text-lg mt-1">{pct(s.repeatAccuracy)}</div></div>
            </div>
            {s.perRule && (
              <div className="mt-4">
                <div className="overline mb-2">per-rule accuracy</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(s.perRule).map(([k, v]) => (
                    <div key={k} className="border border-border rounded-sm p-2">
                      <div className="text-xs text-muted-foreground truncate">{k}</div>
                      <div className="metric text-lg">{v.total ? pct(v.correct / v.total) : "—"}</div>
                      <div className="text-xs text-muted-foreground">{v.correct}/{v.total}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent = "text-foreground", testId }) {
  return (
    <div className="border border-border bg-card p-4 rounded-sm" data-testid={testId}>
      <div className="overline">{label}</div>
      <div className={`metric text-2xl mt-2 ${accent}`}>{value}</div>
    </div>
  );
}

function MatrixCell({ label, value, accent }) {
  return (
    <div className="border border-border p-4 rounded-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="metric text-2xl mt-2" style={{ color: accent }}>{value ?? 0}</div>
    </div>
  );
}
