import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Zap, Trophy, Clock, Brain } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import StatCard from "../components/common/StatCard";
import EmptyState from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { useApp } from "../lib/store";
import { TASK_LIST, getTask } from "../tasks/registry";
import { pct, ms as fms, duration, relativeTime, ymd } from "../lib/format";

export default function Home() {
  const { sessions, lastTaskConfig, presets } = useApp();

  const stats = useMemo(() => {
    const totalDurationMs = sessions.reduce((s, x) => s + (x.durationMs || 0), 0);
    const bestAccuracy = sessions.reduce((m, x) => Math.max(m, x.summary?.metrics?.accuracy || 0), 0);
    const fastest = sessions
      .flatMap((x) => (Number.isFinite(x.summary?.rt?.mean) ? [x.summary.rt.mean] : []))
      .reduce((m, v) => (m == null ? v : Math.min(m, v)), null);
    // Daily streak based on unique days with sessions ending today or earlier
    const days = new Set(sessions.map((s) => ymd(s.createdAt)));
    let streak = 0;
    const day = new Date();
    while (days.has(ymd(day.toISOString()))) {
      streak++;
      day.setDate(day.getDate() - 1);
    }
    // Weekly activity: last 7 days count
    const weekly = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = ymd(d.toISOString());
      const count = sessions.filter((s) => ymd(s.createdAt) === key).length;
      return { key, count, label: d.toLocaleDateString(undefined, { weekday: "short" }) };
    });
    return { totalDurationMs, bestAccuracy, fastest, streak, weekly };
  }, [sessions]);

  const maxCount = Math.max(1, ...stats.weekly.map((w) => w.count));

  return (
    <div>
      <PageHeader
        eyebrow="dashboard"
        title="Cognitive Lab"
        description="Design your own training protocols. Every trial recorded. Nothing hidden."
        actions={
          <>
            {lastTaskConfig && (
              <Button asChild variant="outline" data-testid="continue-btn">
                <Link to={`/tasks/${lastTaskConfig.taskId}?resume=1`}>
                  Continue last <ArrowRight className="w-4 h-4 ml-1.5" strokeWidth={1.5} />
                </Link>
              </Button>
            )}
            <Button asChild data-testid="start-new-btn">
              <Link to="/tasks">New session <ArrowRight className="w-4 h-4 ml-1.5" strokeWidth={1.5} /></Link>
            </Button>
          </>
        }
      />

      <div className="p-6 md:p-10 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard testId="stat-streak" label="Daily streak" value={<span className="flex items-baseline gap-1">{stats.streak}<span className="text-muted-foreground text-sm">d</span></span>} sub="consecutive training days" />
          <StatCard testId="stat-total-time" label="Total training" value={duration(stats.totalDurationMs)} sub={`${sessions.length} sessions`} />
          <StatCard testId="stat-best-accuracy" label="Best accuracy" value={pct(stats.bestAccuracy)} sub="all-time high" accent="text-[hsl(var(--chart-3))]" />
          <StatCard testId="stat-fastest-rt" label="Fastest mean RT" value={fms(stats.fastest)} sub="best session average" accent="text-[hsl(var(--chart-1))]" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Weekly activity */}
          <div className="border border-border bg-card p-5 rounded-sm lg:col-span-2" data-testid="weekly-activity">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="overline">weekly activity</div>
                <div className="font-display text-lg mt-1">Last 7 days</div>
              </div>
              <Flame className="w-5 h-5 text-primary" strokeWidth={1.5} />
            </div>
            <div className="grid grid-cols-7 gap-2 items-end h-32">
              {stats.weekly.map((w) => (
                <div key={w.key} className="flex flex-col items-center gap-1 h-full justify-end">
                  <div
                    className="w-full bg-primary/70 border border-primary rounded-sm"
                    style={{ height: `${(w.count / maxCount) * 100}%`, minHeight: w.count > 0 ? 6 : 2, opacity: w.count > 0 ? 1 : 0.15 }}
                    title={`${w.count} sessions`}
                  />
                  <div className="text-[10px] text-muted-foreground">{w.label}</div>
                  <div className="metric text-xs">{w.count}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick start tasks */}
          <div className="border border-border bg-card p-5 rounded-sm">
            <div className="overline mb-3">quick start</div>
            <div className="space-y-2">
              {TASK_LIST.map((t) => (
                <Link
                  key={t.id}
                  to={`/tasks/${t.id}`}
                  data-testid={`quick-start-${t.id}`}
                  className="flex items-center justify-between p-3 border border-border hover:border-primary rounded-sm bg-input/30"
                  style={{ transitionProperty: "border-color", transitionDuration: "150ms" }}
                >
                  <div>
                    <div className="font-display text-sm">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.short}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Recent sessions */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <div className="overline">recent sessions</div>
              <div className="font-display text-lg mt-1">History</div>
            </div>
            <Link to="/sessions" className="text-xs text-primary hover:underline">view all →</Link>
          </div>
          {sessions.length === 0 ? (
            <EmptyState
              icon={Brain}
              testId="home-empty"
              title="No sessions yet"
              description="Run your first cognitive assessment to start collecting data."
              action={<Button asChild><Link to="/tasks">Choose a task</Link></Button>}
            />
          ) : (
            <div className="border border-border rounded-sm overflow-hidden">
              <table className="w-full text-sm" data-testid="recent-sessions">
                <thead className="border-b border-border bg-secondary/40">
                  <tr>
                    <th className="text-left overline p-3">task</th>
                    <th className="text-left overline p-3 hidden md:table-cell">config</th>
                    <th className="text-right overline p-3">accuracy</th>
                    <th className="text-right overline p-3 hidden md:table-cell">rt</th>
                    <th className="text-right overline p-3">when</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 8).map((s) => {
                    const t = getTask(s.taskId);
                    return (
                      <tr key={s.id} className="border-b border-border hover:bg-secondary/40" style={{ transitionProperty: "background-color", transitionDuration: "150ms" }}>
                        <td className="p-3">
                          <span className="inline-block w-1.5 h-1.5 rounded-full mr-2" style={{ background: t?.color || "hsl(var(--muted-foreground))" }} />
                          <span className="font-display">{t?.name || s.taskId}</span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{t?.describeConfig?.(s.config) || "—"}</td>
                        <td className="p-3 text-right metric">{pct(s.summary?.metrics?.accuracy)}</td>
                        <td className="p-3 text-right metric hidden md:table-cell">{fms(s.summary?.rt?.mean)}</td>
                        <td className="p-3 text-right text-xs text-muted-foreground">{relativeTime(s.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Records + presets shortcut */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <div className="overline">personal records</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-muted-foreground">Best accuracy</div><div className="metric text-2xl">{pct(stats.bestAccuracy)}</div></div>
              <div><div className="text-xs text-muted-foreground">Fastest RT</div><div className="metric text-2xl">{fms(stats.fastest)}</div></div>
              <div><div className="text-xs text-muted-foreground">Streak</div><div className="metric text-2xl">{stats.streak}d</div></div>
              <div><div className="text-xs text-muted-foreground">Sessions</div><div className="metric text-2xl">{sessions.length}</div></div>
            </div>
          </div>
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="overline mb-3">saved presets</div>
            {presets.length === 0 ? (
              <div className="text-sm text-muted-foreground">No presets saved yet. Configure a task and save your favorite setups.</div>
            ) : (
              <div className="space-y-2">
                {presets.slice(0, 4).map((p) => (
                  <Link key={p.id} to={`/tasks/${p.taskId}?preset=${p.id}`} className="flex items-center justify-between p-2 border border-border rounded-sm hover:border-primary" style={{ transitionProperty: "border-color", transitionDuration: "150ms" }}>
                    <div>
                      <div className="text-sm font-display">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.taskId}</div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" strokeWidth={1.5} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
