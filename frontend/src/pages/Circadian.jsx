import React, { useMemo, useState } from "react";
import { LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Clock, Coffee, Moon, Zap, Brain } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { useApp } from "../lib/store";
import { CONTEXT_FIELDS, loadContextMap, setContext, todayKey, correlate } from "../lib/context";
import { pct, ms as fms, num } from "../lib/format";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";

const TT = {
  contentStyle: { background: "#24283b", border: "1px solid #414868", borderRadius: 2, color: "#c0caf5", fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
  cursor: { stroke: "#414868", strokeWidth: 1 },
};

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Circadian() {
  const { sessions } = useApp();
  const [contextMap, setContextMap] = useState(() => loadContextMap());
  const [todayForm, setTodayForm] = useState(() => contextMap[todayKey()] || {});

  const hourly = useMemo(() => {
    const bins = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: `${h}:00`,
      count: 0,
      accSum: 0,
      rtSum: 0, rtN: 0,
      rtValues: [],
    }));
    for (const s of sessions) {
      const h = new Date(s.createdAt).getHours();
      const acc = s.summary?.metrics?.accuracy;
      const rt = s.summary?.rt?.mean;
      bins[h].count++;
      if (Number.isFinite(acc)) bins[h].accSum += acc;
      if (Number.isFinite(rt)) { bins[h].rtSum += rt; bins[h].rtN++; bins[h].rtValues.push(rt); }
    }
    return bins.map((b) => ({
      hour: b.hour,
      label: b.label,
      count: b.count,
      accuracy: b.count ? (b.accSum / b.count) * 100 : null,
      rt: b.rtN ? b.rtSum / b.rtN : null,
      consistency: b.rtValues.length > 1 ? stddev(b.rtValues) / (b.rtSum / b.rtN) : null,
    }));
  }, [sessions]);

  const heat = useMemo(() => {
    // 7 days × 24 hours, cell = session count colored by mean accuracy
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ count: 0, accSum: 0 })));
    for (const s of sessions) {
      const d = new Date(s.createdAt);
      const dow = d.getDay();
      const h = d.getHours();
      grid[dow][h].count++;
      grid[dow][h].accSum += s.summary?.metrics?.accuracy || 0;
    }
    return grid.map((row) => row.map((cell) => ({
      count: cell.count,
      acc: cell.count ? cell.accSum / cell.count : null,
    })));
  }, [sessions]);

  const insights = useMemo(() => {
    const withData = hourly.filter((h) => h.count > 0 && h.accuracy != null);
    if (withData.length === 0) return [];
    const bestAcc = [...withData].sort((a, b) => b.accuracy - a.accuracy)[0];
    const worstAcc = [...withData].sort((a, b) => a.accuracy - b.accuracy)[0];
    const fastest = withData.filter((h) => h.rt != null).sort((a, b) => a.rt - b.rt)[0];
    const mostActive = [...hourly].sort((a, b) => b.count - a.count)[0];
    const list = [];
    if (bestAcc) list.push({ kind: "acc-high", text: `Highest accuracy: ${bestAcc.label} (${bestAcc.accuracy.toFixed(1)}%)` });
    if (worstAcc && worstAcc !== bestAcc) list.push({ kind: "acc-low", text: `Lowest accuracy: ${worstAcc.label} (${worstAcc.accuracy.toFixed(1)}%)` });
    if (fastest) list.push({ kind: "rt-fast", text: `Fastest reactions: ${fastest.label} (${Math.round(fastest.rt)}ms mean)` });
    if (mostActive && mostActive.count > 0) list.push({ kind: "active", text: `Most active time: ${mostActive.label} (${mostActive.count} sessions)` });
    return list;
  }, [hourly]);

  const correlations = useMemo(() => {
    const accMetric = (s) => s.summary?.metrics?.accuracy;
    return CONTEXT_FIELDS.map((f) => {
      const c = correlate(sessions, contextMap, f.key, accMetric);
      return { field: f, r: c.r, n: c.n };
    });
  }, [sessions, contextMap]);

  const saveContext = () => {
    const next = setContext(todayKey(), todayForm);
    setContextMap(loadContextMap());
    toast.success("Context logged for today");
  };

  const totalSessions = sessions.length;

  return (
    <div>
      <PageHeader
        eyebrow="analytics"
        title="Circadian & Lifestyle Analysis"
        description="When you train affects how you perform. Optionally log lifestyle factors to find correlations."
      />
      <div className="p-6 md:p-10 space-y-6">
        {/* Today's context log */}
        <div className="border border-border p-5 rounded-sm bg-card" data-testid="context-log-card">
          <div className="flex items-center gap-2 mb-4">
            <Coffee className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <div className="overline">log today's context · {todayKey()}</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {CONTEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <Label className="text-xs">{f.label}{f.unit ? ` (${f.unit})` : ""}</Label>
                <Input
                  type="number"
                  min={f.min} max={f.max} step={f.step || 1}
                  value={todayForm[f.key] ?? ""}
                  onChange={(e) => setTodayForm({ ...todayForm, [f.key]: e.target.value === "" ? null : Number(e.target.value) })}
                  className="metric mt-1"
                  data-testid={`context-input-${f.key}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-3">
            <button
              onClick={saveContext}
              className="px-4 py-2 rounded-sm border border-primary text-primary hover:bg-primary/10 text-sm"
              style={{ transitionProperty: "background-color", transitionDuration: "150ms" }}
              data-testid="context-save-btn"
            >Save</button>
          </div>
        </div>

        {totalSessions === 0 ? (
          <EmptyState icon={Clock} title="No sessions to analyze" description="Complete some sessions to see how time-of-day affects your performance." />
        ) : (
          <>
            {/* Hourly performance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="hourly-accuracy">
                <div className="overline mb-3">accuracy by hour of day</div>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={hourly}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="hour" stroke="#9aa5ce" fontSize={10} tickFormatter={(v) => `${v}h`} />
                      <YAxis stroke="#9aa5ce" fontSize={10} domain={[0, 100]} unit="%" />
                      <Tooltip {...TT} formatter={(v) => v == null ? "—" : `${v.toFixed(1)}%`} />
                      <Line type="monotone" dataKey="accuracy" stroke="#7aa2f7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="hourly-rt">
                <div className="overline mb-3">reaction time by hour</div>
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer>
                    <LineChart data={hourly}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="hour" stroke="#9aa5ce" fontSize={10} tickFormatter={(v) => `${v}h`} />
                      <YAxis stroke="#9aa5ce" fontSize={10} />
                      <Tooltip {...TT} formatter={(v) => v == null ? "—" : `${Math.round(v)}ms`} />
                      <Line type="monotone" dataKey="rt" stroke="#bb9af7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="hourly-volume">
                <div className="overline mb-3">training volume by hour</div>
                <div style={{ width: "100%", height: 200 }}>
                  <ResponsiveContainer>
                    <BarChart data={hourly}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="hour" stroke="#9aa5ce" fontSize={10} tickFormatter={(v) => `${v}h`} />
                      <YAxis stroke="#9aa5ce" fontSize={10} allowDecimals={false} />
                      <Tooltip {...TT} />
                      <Bar dataKey="count" fill="#9ece6a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="heatmap">
                <div className="overline mb-3">hour × day heatmap (accuracy)</div>
                <div className="flex flex-col gap-1">
                  <div className="grid gap-0.5 text-[9px] text-muted-foreground" style={{ gridTemplateColumns: `36px repeat(24, 1fr)` }}>
                    <div></div>
                    {Array.from({ length: 24 }).map((_, h) => <div key={h} className="text-center">{h % 3 === 0 ? h : ""}</div>)}
                  </div>
                  {heat.map((row, dow) => (
                    <div key={dow} className="grid gap-0.5" style={{ gridTemplateColumns: `36px repeat(24, 1fr)` }}>
                      <div className="text-[9px] text-muted-foreground pr-1 text-right">{DAYS[dow]}</div>
                      {row.map((cell, h) => {
                        const opacity = cell.count > 0 ? Math.max(0.2, cell.acc || 0) : 0;
                        return (
                          <div
                            key={h}
                            className="border border-border"
                            title={cell.count ? `${DAYS[dow]} ${h}:00 · ${cell.count}× · ${((cell.acc || 0) * 100).toFixed(0)}%` : `${DAYS[dow]} ${h}:00 · no sessions`}
                            style={{
                              aspectRatio: "1 / 1",
                              background: cell.count > 0 ? `hsl(var(--chart-1) / ${opacity})` : "hsl(var(--input))",
                            }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {insights.length > 0 && (
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="insights-card">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-primary" strokeWidth={1.5} />
                  <div className="overline">detected patterns</div>
                </div>
                <ul className="space-y-1.5">
                  {insights.map((ins, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-muted-foreground metric text-xs mt-1">·</span>
                      <span>{ins.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Lifestyle correlations */}
            <div className="border border-border p-5 rounded-sm bg-card" data-testid="correlations-card">
              <div className="flex items-center gap-2 mb-3">
                <Moon className="w-4 h-4 text-primary" strokeWidth={1.5} />
                <div className="overline">lifestyle × accuracy (pearson r)</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {correlations.map(({ field, r, n }) => (
                  <div key={field.key} className="border border-border rounded-sm p-3">
                    <div className="text-xs text-muted-foreground">{field.label}</div>
                    <div className="metric text-xl mt-1" style={{
                      color: r == null ? "hsl(var(--muted-foreground))"
                        : r > 0.3 ? "hsl(var(--chart-3))"
                        : r < -0.3 ? "hsl(var(--destructive))"
                        : "hsl(var(--foreground))"
                    }}>{r == null ? "—" : (r > 0 ? "+" : "") + r.toFixed(2)}</div>
                    <div className="text-[10px] text-muted-foreground metric mt-0.5">n = {n}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-muted-foreground mt-3">
                Correlations require at least 3 sessions with matching context logs. Values ≥ +0.3 or ≤ −0.3 hint at meaningful relationships.
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, x) => s + x, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(v);
}
