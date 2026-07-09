import React from "react";
import { Link } from "react-router-dom";
import { Bookmark, Trash2, Play } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { useApp } from "../lib/store";
import { getTask } from "../tasks/registry";
import { toast } from "sonner";

export default function Presets() {
  const { presets, deletePreset } = useApp();
  return (
    <div>
      <PageHeader
        eyebrow="presets"
        title="Saved Protocols"
        description="Reusable configurations for repeatable, comparable sessions."
      />
      <div className="p-6 md:p-10">
        {presets.length === 0 ? (
          <EmptyState icon={Bookmark} title="No presets yet" description="Configure a task and save its settings as a preset for later." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {presets.map((p) => {
              const task = getTask(p.taskId);
              return (
                <div key={p.id} className="border border-border p-5 rounded-sm bg-card" data-testid={`preset-${p.id}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="overline">{task?.name || p.taskId}</div>
                      <div className="font-display text-lg mt-1">{p.name}</div>
                    </div>
                    <div className="w-2 h-2 rounded-full" style={{ background: task?.color }} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-3 min-h-[32px]">{task?.describeConfig(p.config)}</div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" data-testid={`preset-run-${p.id}`}>
                      <Link to={`/tasks/${p.taskId}?preset=${p.id}`}><Play className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />Run</Link>
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { deletePreset(p.id); toast.success("Preset removed"); }} data-testid={`preset-del-${p.id}`}>
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
