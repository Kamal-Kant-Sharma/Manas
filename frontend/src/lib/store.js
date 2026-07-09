// Global app store — React Context wrapping localStorage-backed state.
// Slices: profile, settings, sessions (append-only + trash), presets, goals.

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { storage, uid } from "./storage";

const AppCtx = createContext(null);

const DEFAULT_PROFILE = {
  id: "default",
  name: "Researcher",
  createdAt: new Date().toISOString(),
};

const DEFAULT_SETTINGS = {
  theme: "dark",
  accent: "blue",
  reducedMotion: false,
  soundEnabled: true,
  voiceName: null,
  voiceRate: 1,
  voicePitch: 1,
  voiceVolume: 1,
};

export function AppProvider({ children }) {
  const [profile, setProfileState] = useState(() => storage.get("profile", DEFAULT_PROFILE));
  const [settings, setSettingsState] = useState(() => ({ ...DEFAULT_SETTINGS, ...(storage.get("settings", {}) || {}) }));
  const [sessions, setSessions] = useState(() => storage.get("sessions", []));
  const [trash, setTrash] = useState(() => storage.get("trash", []));
  const [presets, setPresets] = useState(() => storage.get("presets", []));
  const [goals, setGoals] = useState(() => storage.get("goals", []));
  const [lastTaskConfig, setLastTaskConfigState] = useState(() => storage.get("lastTaskConfig", null));

  useEffect(() => storage.set("profile", profile), [profile]);
  useEffect(() => storage.set("settings", settings), [settings]);
  useEffect(() => storage.set("sessions", sessions), [sessions]);
  useEffect(() => storage.set("trash", trash), [trash]);
  useEffect(() => storage.set("presets", presets), [presets]);
  useEffect(() => storage.set("goals", goals), [goals]);
  useEffect(() => storage.set("lastTaskConfig", lastTaskConfig), [lastTaskConfig]);

  const addSession = useCallback((session) => {
    const s = { id: uid(), createdAt: new Date().toISOString(), ...session };
    setSessions((prev) => [s, ...prev]);
    return s;
  }, []);

  const updateSession = useCallback((id, patch) => {
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }, []);

  const deleteSession = useCallback((id) => {
    const target = sessions.find((s) => s.id === id);
    if (!target) return;
    setTrash((t) => [{ ...target, deletedAt: new Date().toISOString() }, ...t]);
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }, [sessions]);

  const restoreSession = useCallback((id) => {
    const target = trash.find((s) => s.id === id);
    if (!target) return;
    const { deletedAt, ...rest } = target;
    setTrash((prev) => prev.filter((s) => s.id !== id));
    setSessions((ss) => [rest, ...ss]);
  }, [trash]);

  const purgeTrash = useCallback(() => setTrash([]), []);

  const savePreset = useCallback((preset) => {
    const p = { id: preset.id || uid(), createdAt: new Date().toISOString(), ...preset };
    setPresets((prev) => {
      const existing = prev.findIndex((x) => x.id === p.id);
      if (existing >= 0) {
        const next = prev.slice();
        next[existing] = { ...prev[existing], ...p };
        return next;
      }
      return [p, ...prev];
    });
    return p;
  }, []);

  const deletePreset = useCallback((id) => {
    setPresets((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addGoal = useCallback((goal) => {
    const g = { id: uid(), createdAt: new Date().toISOString(), ...goal };
    setGoals((prev) => [g, ...prev]);
    return g;
  }, []);

  const deleteGoal = useCallback((id) => setGoals((prev) => prev.filter((g) => g.id !== id)), []);

  const setProfile = useCallback((patch) => setProfileState((p) => ({ ...p, ...patch })), []);
  const setSettings = useCallback((patch) => setSettingsState((s) => ({ ...s, ...patch })), []);
  const setLastTaskConfig = useCallback((cfg) => setLastTaskConfigState(cfg), []);

  const exportAll = useCallback(() => {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      profile,
      settings,
      sessions,
      presets,
      goals,
    };
  }, [profile, settings, sessions, presets, goals]);

  const importAll = useCallback((payload) => {
    if (!payload || typeof payload !== "object") return false;
    if (payload.profile) setProfileState(payload.profile);
    if (payload.settings) setSettingsState({ ...DEFAULT_SETTINGS, ...payload.settings });
    if (Array.isArray(payload.sessions)) setSessions(payload.sessions);
    if (Array.isArray(payload.presets)) setPresets(payload.presets);
    if (Array.isArray(payload.goals)) setGoals(payload.goals);
    return true;
  }, []);

  const value = useMemo(() => ({
    profile, setProfile,
    settings, setSettings,
    sessions, addSession, updateSession, deleteSession, restoreSession,
    trash, purgeTrash,
    presets, savePreset, deletePreset,
    goals, addGoal, deleteGoal,
    lastTaskConfig, setLastTaskConfig,
    exportAll, importAll,
  }), [profile, setProfile, settings, setSettings, sessions, addSession, updateSession, deleteSession, restoreSession, trash, purgeTrash, presets, savePreset, deletePreset, goals, addGoal, deleteGoal, lastTaskConfig, setLastTaskConfig, exportAll, importAll]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const v = useContext(AppCtx);
  if (!v) throw new Error("useApp must be inside AppProvider");
  return v;
}
