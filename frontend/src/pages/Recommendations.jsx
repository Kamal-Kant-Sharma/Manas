import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Compass, TrendingUp, TrendingDown, Minus, Play, Coffee, AlertTriangle } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { useApp } from "../lib/store";
import { buildRecommendations } from "../lib/recommendations";
import { getTask } from "../tasks/registry";
import { pct, int } from "../lib/format";
import { loadRecallState } from "../lib/dailyRecall";

function recallEntriesToSessions() {
  const rs = loadRecallState();
  return (rs.history || []).map((h) => ({
    id: `recall-${h.date}`, taskId: "dailyRecall", createdAt: h.date, config: {},
    summary: { metrics: { accuracy: h.overall ?? 0 }, rt: {} },
  }));
}

export default function Recommendations() {
  const { sessions, goals } = useApp();
  const allData = useMemo(() => [...sessions, ...recallEntriesToSessions()], [sessions]);
  const rec = useMemo(() => buildRecommendations(allData, goals), [allData, goals]);

  const hasData = allData.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="training coach"
        title="Recommendations"
        description="Data-driven suggestions built from your recent sessions and cognitive profile."
      />
      <div className="p-6 md:p-10 space-y-6">
        {!hasData ? (
          <EmptyState icon={Compass} title="No data yet" description="Complete a couple of sessions and check back for personalized suggestions." />
        ) : (
          <>
            {/* Today's focus */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto] gap-4">
              <div className="border border-border border-l-2 border-l-primary p-6 rounded-sm bg-card" data-testid="todays-focus">
                <div className="overline mb-2">today's focus</div>
                <div className="font-display text-2xl">
                  {rec.todayFocus?.label || "Balanced training"}
                </div>
                {rec.todayFocus?.score != null && (
                  <div className="text-sm text-muted-foreground mt-1">Current score: <span className="metric text-foreground">{Math.round(rec.todayFocus.score)}/100</span></div>
                )}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {rec.suggestedTasks.map((s) => (
                    <Link
                      key={s.task.id}
                      to={`/tasks/${s.task.id}`}
                      className="border border-border rounded-sm p-4 hover:border-primary block relative overflow-hidden"
                      style={{ transitionProperty: "border-color", transitionDuration: "150ms" }}
                      data-testid={`suggest-${s.task.id}`}
                    >
                      <div className="absolute top-0 left-0 h-0.5 w-full" style={{ background: s.task.color }} />
                      <div className="flex items-baseline justify-between">
                        <div className="font-display text-lg">{s.task.name}</div>
                        <div className="metric text-primary text-sm">{s.percentage}%</div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{s.task.short}</div>
                      <div className="mt-3 flex items-center text-xs text-primary">
                        <Play className="w-3 h-3 mr-1" strokeWidth={1.5} />start session
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Recommended session length: <span className="metric text-foreground">~{rec.targetMinutes} min</span> · last 7d: <span className="metric text-foreground">{rec.totalMinutes7d} min</span>
                </div>
              </div>

              {/* Rest / stats */}
              <div className="min-w-[240px] flex flex-col gap-4">
                <div className={`border p-5 rounded-sm bg-card ${rec.restDayRecommended ? "border-[hsl(var(--chart-4))]" : "border-border"}`} data-testid="rest-day-card">
                  <div className="overline">rest day</div>
                  <div className="font-display text-lg mt-2">{rec.restDayRecommended ? "Take a break" : "Train today"}</div>
                  <div className="text-xs text-muted-foreground mt-1">{rec.restDayRecommended ? "You've been training a lot — rest improves consolidation." : "Volume looks healthy."}</div>
                </div>
                <div className="border border-border p-5 rounded-sm bg-card">
                  <div className="overline mb-2">last 7 days</div>
                  <div className="metric text-3xl">{rec.totalMinutes7d}<span className="text-sm text-muted-foreground"> min</span></div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {Object.entries(rec.taskCounts7d).length === 0 ? "No training this week" :
                      Object.entries(rec.taskCounts7d).map(([id, c]) => `${getTask(id)?.name || id} ×${c}`).join(" · ")
                    }
                  </div>
                </div>
              </div>
            </div>

            {/* Insights */}
            {rec.insights.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rec.insights.map((ins, i) => (
                  <InsightCard key={i} kind={ins.kind} text={ins.text} testId={`insight-${ins.kind}`} />
                ))}
              </div>
            )}

            {/* Weekly schedule */}
            <div className="border border-border p-5 rounded-sm bg-card" data-testid="weekly-schedule">
              <div className="overline mb-3">suggested weekly schedule</div>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
                {rec.weeklySchedule.map((d, i) => (
                  <div key={i} className={`border p-3 rounded-sm ${d.rest ? "bg-input/40 border-border" : "bg-card border-border"}`}>
                    <div className="overline">{d.day}</div>
                    {d.rest ? (
                      <div className="mt-2 text-sm text-muted-foreground flex items-center gap-1"><Coffee className="w-3 h-3" strokeWidth={1.5} />Rest</div>
                    ) : (
                      <div className="mt-2">
                        <div className="font-display text-sm">{d.task?.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{d.task?.short}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Movement lists */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MovementList title="Plateauing" items={rec.plateauing} icon={Minus} accent="text-[hsl(var(--muted-foreground))]" testId="plateauing-list" />
              <MovementList title="Improving" items={rec.improving} icon={TrendingUp} accent="text-[hsl(var(--chart-3))]" testId="improving-list" />
              <MovementList title="Declining" items={rec.declining} icon={TrendingDown} accent="text-[hsl(var(--destructive))]" testId="declining-list" />
            </div>

            {goals.length > 0 && (
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="goal-hint">
                <div className="overline mb-2">goal alignment</div>
                <div className="text-sm text-muted-foreground">
                  You have <span className="metric text-foreground">{goals.length}</span> active goal{goals.length === 1 ? "" : "s"}.
                  {rec.todayFocus && ` Today's focus (${rec.todayFocus.label}) may contribute to them.`}
                  <Link to="/goals" className="ml-2 text-primary hover:underline">manage goals →</Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InsightCard({ kind, text, testId }) {
  const style = {
    plateau:   { color: "hsl(var(--chart-4))", icon: Minus },
    improving: { color: "hsl(var(--chart-3))", icon: TrendingUp },
    declining: { color: "hsl(var(--destructive))", icon: TrendingDown },
    focus:     { color: "hsl(var(--primary))", icon: Compass },
    "no-data": { color: "hsl(var(--muted-foreground))", icon: AlertTriangle },
  }[kind] || { color: "hsl(var(--muted-foreground))", icon: Compass };
  const Icon = style.icon;
  return (
    <div className="border border-border p-4 rounded-sm bg-card flex items-start gap-3" data-testid={testId}>
      <Icon className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} style={{ color: style.color }} />
      <div className="text-sm">{text}</div>
    </div>
  );
}

function MovementList({ title, items, icon: Icon, accent, testId }) {
  return (
    <div className="border border-border p-4 rounded-sm bg-card" data-testid={testId}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${accent}`} strokeWidth={1.5} />
        <div className="overline">{title}</div>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground">Nothing here yet.</div>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 5).map((d) => (
            <div key={d.id} className="flex items-center justify-between text-sm">
              <span className="font-display">{d.label}</span>
              <span className={`metric text-xs ${accent}`}>
                {d.delta > 0 ? "+" : ""}{d.delta?.toFixed(1) ?? "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
