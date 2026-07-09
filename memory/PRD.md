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
