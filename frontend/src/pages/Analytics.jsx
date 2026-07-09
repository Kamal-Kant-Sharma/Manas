import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { BarChart3 } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { useApp } from "../lib/store";
import { TASK_LIST, getTask } from "../tasks/registry";
import { pct, ms as fms, ymd } from "../lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

const TT = {
  contentStyle: { background: "#24283b", border: "1px solid #414868", borderRadius: 2, color: "#c0caf5", fontFamily: "JetBrains Mono, monospace", fontSize: 12 },
  cursor: { stroke: "#414868", strokeWidth: 1 },
};

export default function Analytics() {
  const { sessions } = useApp();
  const [taskFilter, setTaskFilter] = useState("all");
  const [range, setRange] = useState("30");

  const filtered = useMemo(() => {
    const now = Date.now();
    const rangeMs = range === "all" ? Infinity : Number(range) * 24 * 60 * 60 * 1000;
    return sessions.filter((s) => {
      const inRange = now - new Date(s.createdAt).getTime() <= rangeMs;
      const inTask = taskFilter === "all" || s.taskId === taskFilter;
      return inRange && inTask;
    });
  }, [sessions, taskFilter, range]);

  // Accuracy timeline
  const timeline = useMemo(() => {
    return [...filtered]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .map((s, i) => ({
        i: i + 1,
        accuracy: (s.summary?.metrics?.accuracy || 0) * 100,
        rt: s.summary?.rt?.mean || null,
        task: s.taskId,
        date: ymd(s.createdAt),
      }));
  }, [filtered]);

  // Task distribution
  const taskDist = useMemo(() => {
    const map = {};
    for (const s of filtered) map[s.taskId] = (map[s.taskId] || 0) + 1;
    return Object.entries(map).map(([task, count]) => ({ task, count, name: getTask(task)?.name || task }));
  }, [filtered]);

  // Daily volume
  const dailyVolume = useMemo(() => {
    const days = {};
    for (const s of filtered) days[ymd(s.createdAt)] = (days[ymd(s.createdAt)] || 0) + 1;
    return Object.entries(days).sort((a, b) => a[0].localeCompare(b[0])).map(([d, count]) => ({ d, count }));
  }, [filtered]);

  // RT scatter
  const rtScatter = useMemo(() => {
    return filtered
      .filter((s) => Number.isFinite(s.summary?.rt?.mean))
      .map((s) => ({
        acc: (s.summary?.metrics?.accuracy || 0) * 100,
        rt: s.summary.rt.mean,
        task: s.taskId,
      }));
  }, [filtered]);

  const PIE_COLORS = ["#7aa2f7", "#bb9af7", "#9ece6a", "#e0af68", "#f7768e"];

  return (
    <div>
      <PageHeader
        eyebrow="analytics"
        title="Performance Analytics"
        description="Long-term trends across all your training. Filter by task and time range."
      />
      <div className="p-6 md:p-10 space-y-6">
        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="min-w-[200px]">
            <div className="overline mb-1">task</div>
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger data-testid="analytics-task-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tasks</SelectItem>
                {TASK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[160px]">
            <div className="overline mb-1">range</div>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger data-testid="analytics-range-filter"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 365 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-xs text-muted-foreground metric">
            {filtered.length} sessions in range
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={BarChart3} title="No data in this range" description="Complete a session or widen your filters." />
        ) : (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="border border-border p-5 rounded-sm bg-card" data-testid="chart-accuracy-timeline">
                <div className="overline mb-3">accuracy timeline</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={timeline}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="i" stroke="#9aa5ce" fontSize={10} />
                      <YAxis stroke="#9aa5ce" fontSize={10} unit="%" domain={[0, 100]} />
                      <Tooltip {...TT} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                      <Line type="monotone" dataKey="accuracy" stroke="#7aa2f7" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-border p-5 rounded-sm bg-card" data-testid="chart-rt-timeline">
                <div className="overline mb-3">mean reaction time (ms)</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <LineChart data={timeline}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="i" stroke="#9aa5ce" fontSize={10} />
                      <YAxis stroke="#9aa5ce" fontSize={10} />
                      <Tooltip {...TT} formatter={(v) => v == null ? "—" : `${Math.round(v)} ms`} />
                      <Line type="monotone" dataKey="rt" stroke="#bb9af7" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-border p-5 rounded-sm bg-card" data-testid="chart-daily-volume">
                <div className="overline mb-3">sessions per day</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={dailyVolume}>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis dataKey="d" stroke="#9aa5ce" fontSize={10} />
                      <YAxis stroke="#9aa5ce" fontSize={10} allowDecimals={false} />
                      <Tooltip {...TT} />
                      <Bar dataKey="count" fill="#9ece6a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-border p-5 rounded-sm bg-card" data-testid="chart-task-dist">
                <div className="overline mb-3">task distribution</div>
                <div style={{ width: "100%", height: 240 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={taskDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={{ fill: "#c0caf5", fontSize: 11 }}>
                        {taskDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip {...TT} />
                      <Legend wrapperStyle={{ fontSize: 11, color: "#c0caf5" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border border-border p-5 rounded-sm bg-card lg:col-span-2" data-testid="chart-rt-scatter">
                <div className="overline mb-3">accuracy × reaction time</div>
                <div style={{ width: "100%", height: 260 }}>
                  <ResponsiveContainer>
                    <ScatterChart>
                      <CartesianGrid stroke="#414868" strokeDasharray="2 4" />
                      <XAxis type="number" dataKey="rt" name="RT (ms)" stroke="#9aa5ce" fontSize={10} />
                      <YAxis type="number" dataKey="acc" name="Accuracy %" stroke="#9aa5ce" fontSize={10} unit="%" domain={[0, 100]} />
                      <Tooltip {...TT} />
                      <Scatter data={rtScatter} fill="#e0af68" />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
