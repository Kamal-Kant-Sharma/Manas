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
- Home dashboard: streak, total training time, best accuracy, fastest RT, weekly activity bar chart, quick-start cards, recent sessions table, personal records, saved presets
- **N-Back task**: multi-stream (8 stream types: position/color/number/letter/shape/symbol/audioLetter/audioNumber), 3×3 to 9×9 grid, adjustable N, stimulus/ISI/reaction-window timing, target probability, warm-up trials, per-stream response buttons + keyboard hotkeys, per-stream confusion matrices + radar chart
- **PASAT task**: paced serial addition with audio+visual, 6 operations (add/sub/mul/div/mod/avg), single/alternating/random modes, adjustable range, negatives, decimals, per-operation breakdown
- **Memory Span task**: 8 stimulus types (digits/letters/words/colors/shapes/positions/audio-*), 5 recall modes (forward/backward/asc/desc/alphabetical), adaptive length progression, position + order errors
- **Analytics**: line chart (accuracy timeline), line chart (mean RT timeline), bar chart (daily volume), pie chart (task distribution), scatter (accuracy × RT), filters by task + date range (7/30/90/365/all)
- **Session Summary**: KPIs (accuracy/F1/precision/recall/mean/median/min/σ), confusion matrix cells, rolling accuracy line, RT histogram, per-stream radar, PASAT per-op accuracy, memory-span score
- **Sessions page**: search, task filter, delete → trash → restore, purge trash, JSON export, CSV export, JSON import, session detail dialog
- **Presets**: save current config with name, load into launcher, delete, run direct from card
- **Goals**: set targets on accuracy / meanRT / N-level / max span / sessions count; auto-evaluated against current data; achieved goals get green border + check icon
- **Settings**: profile name, sound toggle, voice selector + test button, reduced motion, clear all data
- **Design**: Tokyo Night dark IDE palette, Chivo (display) / IBM Plex Sans (body) / JetBrains Mono (metrics), 1px flat borders, grain texture overlay, no glassmorphism, sharp 4px corners, subtle radial background wash, custom scrollbar
- Sidebar navigation with active-item accent stripe; mobile top-nav with horizontal scroll
- Runners hide chrome for immersive gameplay

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
