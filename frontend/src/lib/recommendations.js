// Training Recommendation Engine.
// Given sessions + goals + profile, produce concrete recommendations.

import { getTask, TASK_LIST } from "../tasks/registry";
import { COGNITIVE_DOMAINS, computeDomainScores, computeDomainTrends, sessionScore, domainLabel } from "./domains";

const PLATEAU_DELTA = 1.5;   // absolute score change under which we consider a plateau
const IMPROVING_DELTA = 3;   // above which we consider it improving

export function detectPlateaus(sessions) {
  const trends = computeDomainTrends(sessions, { windowDays: 14 });
  const plateauing = [];
  const improving = [];
  const declining = [];
  for (const d of COGNITIVE_DOMAINS) {
    const t = trends[d.id];
    if (t.current == null || t.previous == null) continue;
    if (t.contributions < 2) continue;
    if (t.delta >= IMPROVING_DELTA) improving.push({ ...d, ...t });
    else if (t.delta <= -IMPROVING_DELTA) declining.push({ ...d, ...t });
    else if (Math.abs(t.delta) < PLATEAU_DELTA) plateauing.push({ ...d, ...t });
  }
  return { plateauing, improving, declining, trends };
}

// Rank domains by (weakness × training-history) so under-trained weak domains get priority.
export function rankFocusDomains(sessions) {
  const scores = computeDomainScores(sessions, { rangeDays: 30 });
  const ranked = COGNITIVE_DOMAINS.map((d) => {
    const s = scores[d.id];
    const contributions = s?.contributions || 0;
    const score = s?.score;
    // If no data → highest priority (100)
    // If has data → priority = 100 - score (lower score = more room to grow)
    const priority = score == null ? 100 - Math.min(20, contributions * 2) : (100 - score);
    return { ...d, score, contributions, priority };
  });
  ranked.sort((a, b) => b.priority - a.priority);
  return ranked;
}

// Which tasks contribute to a given domain, sorted by contribution weight?
export function tasksForDomain(domainId) {
  return TASK_LIST
    .map((t) => ({ task: t, weight: t.domainContributions?.[domainId] || 0 }))
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight);
}

// Build daily & weekly training recommendation.
export function buildRecommendations(sessions, goals = [], opts = {}) {
  const { maxSuggestions = 3 } = opts;
  const { plateauing, improving, declining, trends } = detectPlateaus(sessions);
  const focus = rankFocusDomains(sessions).slice(0, 3);

  // Recent training pattern
  const nowMs = Date.now();
  const last7Days = sessions.filter((s) => (nowMs - new Date(s.createdAt).getTime()) < 7 * 86400000);
  const totalMinutes7d = Math.round(last7Days.reduce((s, x) => s + (x.durationMs || 0), 0) / 60000);
  const taskCounts7d = {};
  for (const s of last7Days) taskCounts7d[s.taskId] = (taskCounts7d[s.taskId] || 0) + 1;

  // Recommend tasks that hit the weakest focus domains
  const taskWeights = {}; // { taskId: totalWeight }
  for (const d of focus) {
    for (const { task, weight } of tasksForDomain(d.id)) {
      taskWeights[task.id] = (taskWeights[task.id] || 0) + weight * (100 - (d.score ?? 50)) / 100;
    }
  }
  const suggested = Object.entries(taskWeights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxSuggestions)
    .map(([taskId, w]) => {
      const total = Object.values(taskWeights).reduce((s, x) => s + x, 0) || 1;
      return {
        task: getTask(taskId),
        percentage: Math.round((w / total) * 100),
      };
    });
  // Renormalize percentages so they sum to 100
  if (suggested.length) {
    const sum = suggested.reduce((s, x) => s + x.percentage, 0);
    if (sum > 0) {
      suggested.forEach((s) => { s.percentage = Math.round((s.percentage / sum) * 100); });
    }
  }

  // Suggested session length: 15-30 minutes based on recent volume
  const targetMinutes = totalMinutes7d < 30 ? 15 : totalMinutes7d > 210 ? 10 : 20;

  // Rest day suggestion
  const sessionsToday = sessions.filter((s) => {
    const d = new Date(s.createdAt); d.setHours(0,0,0,0);
    const t = new Date(); t.setHours(0,0,0,0);
    return d.getTime() === t.getTime();
  }).length;
  const restDayRecommended = sessionsToday >= 4 && totalMinutes7d > 150;

  // Weekly schedule: 5 training days, 2 rest, tasks rotated
  const schedule = buildWeeklySchedule(focus, suggested);

  // Text insights
  const insights = [];
  if (plateauing.length) {
    const p = plateauing[0];
    insights.push({
      kind: "plateau",
      text: `${p.label} has plateaued (Δ ${p.delta > 0 ? "+" : ""}${p.delta.toFixed(1)}) over the last 14 days. Consider increasing task difficulty or trying a different contributing task.`,
    });
  }
  if (improving.length) {
    const i = improving[0];
    insights.push({
      kind: "improving",
      text: `${i.label} is improving rapidly (+${i.delta.toFixed(1)} pts). Keep your current protocol going.`,
    });
  }
  if (declining.length) {
    const d = declining[0];
    insights.push({
      kind: "declining",
      text: `${d.label} has declined (−${Math.abs(d.delta).toFixed(1)}). Check for fatigue or increased difficulty.`,
    });
  }
  if (focus[0] && focus[0].score != null && focus[0].score < 55) {
    insights.push({
      kind: "focus",
      text: `${focus[0].label} is your weakest measured domain (${focus[0].score.toFixed(0)}/100). Prioritize contributing tasks this week.`,
    });
  }
  if (focus[0] && focus[0].score == null) {
    insights.push({
      kind: "no-data",
      text: `No data yet for ${focus[0].label}. Try a task that trains this domain to start measuring it.`,
    });
  }

  return {
    todayFocus: focus[0] || null,
    focusDomains: focus,
    suggestedTasks: suggested,
    targetMinutes,
    restDayRecommended,
    weeklySchedule: schedule,
    insights,
    plateauing,
    improving,
    declining,
    trends,
    totalMinutes7d,
    taskCounts7d,
  };
}

function buildWeeklySchedule(focus, suggested) {
  // Simple 7-day plan: 5 training + 2 rest. Distribute suggestedTasks in rotation.
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const tasks = suggested.map((s) => s.task).filter(Boolean);
  const plan = [];
  const restDays = new Set([2, 5]); // Wed + Sat rest
  let taskIdx = 0;
  for (let i = 0; i < 7; i++) {
    if (restDays.has(i) || tasks.length === 0) {
      plan.push({ day: days[i], rest: true, task: null });
    } else {
      const t = tasks[taskIdx % tasks.length];
      plan.push({ day: days[i], rest: false, task: t });
      taskIdx++;
    }
  }
  return plan;
}
