# Neuroforge — Brain Training Lab

## Problem Statement (verbatim from user)
Highly customizable brain training platform focused on measuring and improving cognitive abilities through scientifically-inspired tasks. Unlike existing brain training apps, every task should be almost completely customizable. Priority is not flashy graphics, but flexibility, scientific usefulness, and extremely detailed statistics. Feel: combination of Brain Workshop, Quantified Self, Chess.com statistics, Fitness tracker, Research experiment software.

## User Choices (First Iteration)
- User accounts: **Local-only, single-device, no login (offline-first)**
- Scope: **All 3 tasks (N-Back, PASAT, Memory Span) + full stats dashboard**
- Storage: **Browser localStorage only (no backend)**
- Theme: **Dark IDE-like (Tokyo Night)**
- Audio: **Browser Web Speech API (offline)**

## Architecture
Pure React frontend, no backend. Modular task registry — each task is self-contained in `/src/tasks/{taskId}/` with `module.js` (config + engine + metadata), `Runner.jsx` (gameplay), `Settings.jsx` (config form). Global store in `/src/lib/store.js` persists to localStorage under `neuroforge:v1:*` keys. Generic statistics engine in `/src/lib/stats.js` (confusion matrix, precision/recall/F1, RT stats, streaks, rolling averages) works across all tasks. Adding a future cognitive task = drop a folder + register in `/src/tasks/registry.js`.

## User Personas
- **Enthusiast**: casual trainer who wants clean stats, PRs, streaks
- **Competitive user**: pushes N-level, tunes timing, saves presets, tracks trend lines
- **Researcher**: needs reproducibility (seed), full trial-level data, export CSV/JSON, custom protocols

## What's Been Implemented (2026-02-09)

### Iteration 3 additions
- **Cognitive Profile System** — 15 domains, generic scoring engine (`sessionScore = (acc·0.55 + rtNorm·0.25 + consistency·0.20) × difficulty × recency`, half-life 10d), radar + trend + progress bars page at `/profile`. Virtual `dailyRecall` task feeds Long-Term Memory.
- **Circadian & Lifestyle Analysis** at `/circadian` — hourly accuracy/RT/volume charts, hour×day heatmap, auto-insights (best/worst hours), optional context logging (sleep, mood, stress, caffeine, energy) with Pearson correlations vs accuracy.
- **Training Recommendation Engine** at `/recommendations` — today's focus domain, top-3 suggested tasks (largest-remainder rounded to 100%), 7-day schedule (5 training + 2 rest), rest-day suggestion, plateau/improving/declining insights, goal alignment.
- **Corsi Block-Tapping Test** — new modular task (classic 9-block scatter / grid / random layouts, forward/backward, adaptive length). All 6 tasks now declare `domainContributions`.
- Sidebar: 10 nav items (Dashboard, Tasks, Profile, Coach, Analytics, Circadian, Sessions, Presets, Goals, Settings).
- Fixes: Corsi RT stdev/median/min/max now computed from real per-attempt data (was hardcoded 0); Recommendations task % uses largest-remainder rounding (always sums to 100).

### Iteration 2 additions
- **Task Switching** — 4 quadrants × 11 built-in rules (letter case/vowel/before-M/curved; number even/prime/>N/<N/±/divisible; color match). Stats: switch cost, per-quadrant + per-rule accuracy.
- **Operation Span (OSPAN)** — memorize → distractor → recall alternation. Item pool × 6 recall modes. Distractors: mental arithmetic + spatial pattern matching. Reports memory/distractor/combined + absolute + partial span.
- **Daily Delayed Recall** — dashboard feature. Auto-generates phrase + number, recall next day, Levenshtein for phrase, streak/longest streak/history heatmap.
- **PASAT rolling window** — `windowSize` field (2..8), added GCD & LCM ops.

### Iteration 1 core
- Home dashboard (streak, total time, best accuracy, fastest RT, weekly bar chart, quick-start, recent sessions, PRs, presets).
- **N-Back**: 8 stream types, 3×3–9×9 grid, adjustable N/timing/prob, per-stream confusion matrices + radar.
- **PASAT**: paced serial addition, 6 (now 8) ops, single/alt/random modes.
- **Memory Span**: 8 stimulus types × 5 recall modes, adaptive length.
- Analytics (line/bar/pie/scatter/heatmap/radar), filters by task + date range.
- Session Summary (KPIs, confusion matrix, rolling accuracy, RT histogram, per-stream radar).
- Sessions log (search, filter, delete→trash→restore, JSON+CSV export, JSON import, detail dialog).
- Presets, Goals (auto-evaluated), Settings.
- Design: Tokyo Night dark IDE palette; Chivo + IBM Plex Sans + JetBrains Mono; sharp 4px corners; grain overlay.

## Prioritized Backlog

### P1 (Next up)
- **Adaptive N-back logic** (auto-raise/lower N based on accuracy) — the flag exists but engine treats it as fixed
- **Per-session detail page** (not just dialog) with trial-by-trial timeline scroll
- **Merge/duplicate/rename/tag** sessions (delete + restore + export already implemented)
- **Corsi Block Test** (spatial span) — first "future task" to add via the registry
- **Reaction time only task** (baseline calibration)

### P2 (Later)
- Stroop, Go/No-Go, Flanker, Task Switching, Multi-object Tracking, Trail Making, Mental Rotation
- **PDF report export** (charts + summary)
- **Cloud sync** (optional Emergent auth + backend persistence)
- Weekly / monthly / yearly report pages
- Advanced filters (per-stream, per-operation, per-tag)
- Multi-profile support (data model already keyed by profile.id)
- Keyboard shortcuts overlay
- Undo toast on delete
- Audio: pitch/rate/volume per stream in N-back settings (currently global)

## Fixed Bugs
- **restoreSession / deleteSession duplication** under React.StrictMode: nested `setState` inside another updater caused double-execution. Refactored to compute target outside updater and call setSessions/setTrash independently. Confirmed 3 → delete → 2 → restore → 3 (no duplication).
- **describeConfig crashes** on malformed configs: added defensive optional chaining in all 3 task modules.
