import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import { TASK_LIST } from "../tasks/registry";

export default function TasksIndex() {
  return (
    <div>
      <PageHeader
        eyebrow="tasks"
        title="Cognitive Tasks"
        description="Pick a task, tune every parameter, and run a session. All data is stored locally on this device."
      />
      <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {TASK_LIST.map((t) => (
          <Link
            key={t.id}
            to={`/tasks/${t.id}`}
            data-testid={`task-card-${t.id}`}
            className="border border-border p-6 rounded-sm bg-card hover-card-lift block relative overflow-hidden group"
          >
            <div className="absolute top-0 left-0 h-0.5 w-full" style={{ background: t.color }} />
            <div className="overline">{t.id}</div>
            <div className="font-display text-2xl mt-3">{t.name}</div>
            <div className="text-sm text-muted-foreground mt-2">{t.short}</div>
            <div className="mt-6 flex items-center text-xs text-primary">
              configure & run <ArrowRight className="w-3 h-3 ml-1" strokeWidth={1.5} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
