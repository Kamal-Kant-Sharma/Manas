import React, { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { Play, Save, RotateCcw } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { getTask } from "../tasks/registry";
import { useApp } from "../lib/store";
import NBackSettings from "../tasks/nback/Settings";
import PASATSettings from "../tasks/pasat/Settings";
import MemorySpanSettings from "../tasks/memorySpan/Settings";
import { toast } from "sonner";

const SETTINGS_COMPONENT = {
  nback: NBackSettings,
  pasat: PASATSettings,
  memorySpan: MemorySpanSettings,
};

export default function TaskLauncher() {
  const { taskId } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { presets, savePreset, lastTaskConfig } = useApp();
  const task = getTask(taskId);
  const SettingsUI = SETTINGS_COMPONENT[taskId];

  const initialConfig = useMemo(() => {
    const presetId = sp.get("preset");
    if (presetId) {
      const p = presets.find((x) => x.id === presetId);
      if (p) return p.config;
    }
    if (sp.get("resume") === "1" && lastTaskConfig?.taskId === taskId) return lastTaskConfig;
    return { ...task?.defaults };
  }, [sp, presets, taskId, lastTaskConfig, task]);

  const [config, setConfig] = useState(initialConfig);
  const [presetName, setPresetName] = useState("");

  useEffect(() => { setConfig(initialConfig); }, [initialConfig]);

  if (!task || !SettingsUI) {
    return <div className="p-10">Unknown task: {taskId}</div>;
  }

  const run = () => {
    // Persist config as "last used"
    nav(`/run/${taskId}`, { state: { config } });
  };

  const saveAsPreset = () => {
    if (!presetName.trim()) {
      toast.error("Give the preset a name");
      return;
    }
    savePreset({ name: presetName.trim(), taskId, config });
    toast.success(`Preset "${presetName.trim()}" saved`);
    setPresetName("");
  };

  const reset = () => setConfig({ ...task.defaults });

  return (
    <div>
      <PageHeader
        eyebrow={`task · ${task.id}`}
        title={`Configure ${task.name}`}
        description={task.describeConfig(config)}
        actions={
          <>
            <Button variant="outline" onClick={reset} data-testid="reset-config-btn">
              <RotateCcw className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Reset
            </Button>
            <Button onClick={run} data-testid="start-session-btn">
              <Play className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Start session
            </Button>
          </>
        }
      />
      <div className="p-6 md:p-10 grid grid-cols-1 lg:grid-cols-[1fr,320px] gap-8">
        <div>
          <SettingsUI value={config} onChange={setConfig} />
        </div>
        <aside className="space-y-6">
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="overline mb-3">save preset</div>
            <div className="flex flex-col gap-2">
              <Input
                placeholder="Preset name (e.g., Dual 4-back research)"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                data-testid="preset-name-input"
              />
              <Button variant="outline" onClick={saveAsPreset} data-testid="save-preset-btn">
                <Save className="w-4 h-4 mr-1.5" strokeWidth={1.5} /> Save current config
              </Button>
            </div>
          </div>
          {presets.filter((p) => p.taskId === taskId).length > 0 && (
            <div className="border border-border p-5 rounded-sm bg-card">
              <div className="overline mb-3">your presets</div>
              <div className="space-y-1">
                {presets.filter((p) => p.taskId === taskId).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setConfig(p.config)}
                    className="w-full text-left px-3 py-2 border border-border rounded-sm hover:border-primary text-sm"
                    data-testid={`load-preset-${p.id}`}
                    style={{ transitionProperty: "border-color", transitionDuration: "150ms" }}
                  >
                    <div className="font-display">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{task.describeConfig(p.config)}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="border border-border p-5 rounded-sm bg-card">
            <div className="overline mb-2">tip</div>
            <div className="text-xs text-muted-foreground">
              Every trial's stimulus, response, and reaction time is stored. You can filter by any setting later in Analytics.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
