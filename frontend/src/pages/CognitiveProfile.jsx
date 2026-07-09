import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts";
import { Sparkles, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { useApp } from "../lib/store";
import { COGNITIVE_DOMAINS, computeDomainScores, computeDomainTrends, overallCognitiveScore, computeSnapshotSeries } from "../lib/domains";
import { loadRecallState } from "../lib/dailyRecall";
import { pct, num, int } from "../lib/format";

const TT = {
  contentStyle: { background: "#24283b", border: "1px solid #414868", borderRadius: 2, color: "#c0caf5", fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
  cursor: { stroke: "#414868", strokeWidth: 1 },
};

// Convert daily recall history entries into pseudo-sessions so profile scoring picks them up.
function recallEntriesToSessions() {
  const rs = loadRecallState();
  return (rs.history || []).map((h) => ({
    id: `recall-${h.date}`,
    taskId: "dailyRecall",
    createdAt: h.date,
    config: {},
    summary: {
      metrics: { accuracy: h.overall ?? 0, precision: h.overall ?? 0, recall: h.overall ?? 0, f1: h.overall ?? 0 },
      rt: { mean: null, median: null, min: null, max: null, stdev: null },
    },
  }));
}

export default function CognitiveProfile() {
  const { sessions } = useApp();
  const allData = useMemo(() => [...sessions, ...recallEntriesToSessions()], [sessions]);

  const scores    = useMemo(() => computeDomainScores(allData, { rangeDays: null }), [allData]);
  const trends    = useMemo(() => computeDomainTrends(allData, { windowDays: 14 }), [allData]);
  const overall   = useMemo(() => overallCognitiveScore(scores), [scores]);
  const snapshots = useMemo(() => computeSnapshotSeries(allData, 30), [allData]);

  const radarData = COGNITIVE_DOMAINS
    .filter((d) => scores[d.id]?.score != null)
    .map((d) => ({ domain: d.label, value: Math.round(scores[d.id].score) }));

  const rows = COGNITIVE_DOMAINS.map((d) => ({
    ...d,
    score: scores[d.id]?.score,
    contributions: scores[d.id]?.contributions || 0,
    delta: trends[d.id]?.delta,
  }));

  const measured = rows.filter((r) => r.score != null);
  const strongest = [...measured].sort((a, b) => b.score - a.score).slice(0, 3);
  const weakest   = [...measured].sort((a, b) => a.score - b.score).slice(0, 3);
  const improving = [...measured].filter((r) => r.delta != null).sort((a, b) => b.delta - a.delta).slice(0, 3).filter((r) => r.delta > 0);
  const declining = [...measured].filter((r) => r.delta != null).sort((a, b) => a.delta - b.delta).slice(0, 3).filter((r) => r.delta < 0);

  return (
    <div>
      <PageHeader
        eyebrow="cognitive profile"
        title="Your Cognitive Profile"
        description={`${measured.length} of ${COGNITIVE_DOMAINS.length} domains have data · overall score computed from ${allData.length} records`}
      />
      <div className="p-6 md:p-10 space-y-6">
        {measured.length === 0 ? (
          <EmptyState icon={Sparkles} title="No profile data yet" description="Complete at least one training session (or a daily recall) to start building your cognitive profile." action={
            <Link to="/tasks" className="text-primary text-sm hover:underline">→ Go to tasks</Link>
          } />
        ) : (
          <>
            {/* Overall score + radar */}
            <div className="grid grid-cols-1 lg:grid-cols-[300px,1fr] gap-4">
              <div className="border border-border p-6 rounded-sm bg-card flex flex-col items-center justify-center" data-testid="overall-score">
                <div className="overline">overall cognitive score</div>
                <div className="metric text-7xl font-display mt-3">{overall != null ? Math.round(overall) : "—"}</div>
                <div className="text-xs text-muted-foreground mt-2">out of 100</div>
                <div className="hr-dot my-4 w-full" />
                <div className="grid grid-cols-2 gap-4 text-center w-full">
                  <div>
                    <div className="overline">strongest</div>
                    <div className="font-display text-sm mt-1 truncate">{strongest[0]?.label || "—"}</div>
                    <div className="metric text-xs text-muted-foreground">{strongest[0] ? int(strongest[0].score) : "—"}</div>
                  </div>
                  <div>
                    <div className="overline">weakest</div>
                    <div className="font-display text-sm mt-1 truncate">{weakest[0]?.label || "—"}</div>
                    <div className="metric text-xs text-muted-foreground">{weakest[0] ? int(weakest[0].score) : "—"}</div>
                  </div>
                </div>
              </div>
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="domain-radar">
                <div className="overline mb-3">domain radar</div>
                <div style={{ width: "100%", height: 340 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#414868" />
                      <PolarAngleAxis dataKey="domain" stroke="#9aa5ce" fontSize={10} />
                      <PolarRadiusAxis stroke="#9aa5ce" fontSize={9} angle={30} domain={[0, 100]} />
                      <Radar name="score" dataKey="value" stroke="#7aa2f7" fill="#7aa2f7" fillOpacity={0.35} />
                      <Tooltip {...TT} formatter={(v) => `${v}/100`} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* 30-day trend */}
            <div className="border border-border p-5 rounded-sm bg-card" data-testid="profile-trend">
              <div className="overline mb-3">overall score · last 30 days</div>
              <div style={{ width: "100%", height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={snapshots}>
                    <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                    <XAxis dataKey="date" stroke="#9aa5ce" fontSize={9} />
                    <YAxis stroke="#9aa5ce" fontSize={10} domain={[0, 100]} />
                    <Tooltip {...TT} formatter={(v) => v == null ? "—" : `${Math.round(v)}`} />
                    <Line type="monotone" dataKey="overall" stroke="#bb9af7" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Strengths / Weaknesses / Recent movement */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MoversCard title="Strongest" items={strongest} icon={TrendingUp} accent="text-[hsl(var(--chart-3))]" testId="movers-strongest" />
              <MoversCard title="Weakest" items={weakest} icon={TrendingDown} accent="text-[hsl(var(--destructive))]" testId="movers-weakest" />
              <MoversCard title="Recent improvements" items={improving} icon={TrendingUp} accent="text-[hsl(var(--chart-3))]" isDelta testId="movers-improving" />
            </div>

            {/* Full domain progress bars */}
            <div className="border border-border p-5 rounded-sm bg-card" data-testid="domain-bars">
              <div className="flex items-baseline justify-between mb-4">
                <div className="overline">all domains</div>
                <div className="text-xs text-muted-foreground">score · Δ 14d · n</div>
              </div>
              <div className="space-y-3">
                {rows.map((r) => (
                  <div key={r.id}>
                    <div className="flex items-baseline justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display">{r.label}</span>
                        {r.score == null && <span className="overline">no data</span>}
                      </div>
                      <div className="flex items-center gap-3 metric text-xs">
                        <span className={r.score != null ? "text-foreground" : "text-muted-foreground"}>{r.score != null ? Math.round(r.score) : "—"}</span>
                        <span className={r.delta > 0 ? "text-[hsl(var(--chart-3))]" : r.delta < 0 ? "text-[hsl(var(--destructive))]" : "text-muted-foreground"}>
                          {r.delta == null ? "—" : `${r.delta > 0 ? "+" : ""}${r.delta.toFixed(1)}`}
                        </span>
                        <span className="text-muted-foreground w-6 text-right">{r.contributions}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-input rounded-sm overflow-hidden">
                      <div
                        className="h-full"
                        style={{
                          width: `${r.score ?? 0}%`,
                          background: r.score == null ? "hsl(var(--muted))" : "hsl(var(--primary))",
                          transition: "width 400ms ease-out",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {declining.length > 0 && (
              <div className="border border-border border-l-2 border-l-[hsl(var(--destructive))] p-5 rounded-sm bg-card" data-testid="declining-alert">
                <div className="overline mb-2 text-[hsl(var(--destructive))]">recent declines</div>
                {declining.map((d) => (
                  <div key={d.id} className="text-sm">
                    <span className="font-display">{d.label}</span>
                    <span className="text-muted-foreground metric ml-2">{d.delta.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <span className="metric">algorithm:</span> score = (accuracy · 0.55 + rt_norm · 0.25 + consistency · 0.20) × task_difficulty ×
              recency (half-life 10d), aggregated per-domain by contribution weights.
              <Link to="/recommendations" className="ml-3 text-primary hover:underline inline-flex items-center">
                see recommendations <ArrowRight className="w-3 h-3 ml-1" strokeWidth={1.5} />
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MoversCard({ title, items, icon: Icon, accent, isDelta, testId }) {
  return (
    <div className="border border-border p-5 rounded-sm bg-card" data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accent}`} strokeWidth={1.5} />
        <div className="overline">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">Not enough data yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span className="font-display">{r.label}</span>
              <span className={`metric text-xs ${accent}`}>
                {isDelta ? (r.delta > 0 ? "+" : "") + r.delta?.toFixed(1) : Math.round(r.score)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
