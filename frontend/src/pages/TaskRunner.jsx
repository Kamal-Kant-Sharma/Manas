import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getTask } from "../tasks/registry";
import { useApp } from "../lib/store";
import NBackRunner from "../tasks/nback/Runner";
import PASATRunner from "../tasks/pasat/Runner";
import MemorySpanRunner from "../tasks/memorySpan/Runner";
import SessionSummary from "./SessionSummary";
import { toast } from "sonner";

const RUNNER = {
  nback: NBackRunner,
  pasat: PASATRunner,
  memorySpan: MemorySpanRunner,
};

export default function TaskRunner() {
  const { taskId } = useParams();
  const nav = useNavigate();
  const loc = useLocation();
  const { addSession, setLastTaskConfig } = useApp();
  const task = getTask(taskId);
  const Runner = RUNNER[taskId];

  const config = useMemo(() => loc.state?.config || task?.defaults, [loc.state, task]);
  const [result, setResult] = useState(null);
  const [startTime] = useState(() => Date.now());

  useEffect(() => {
    if (!config) return;
    setLastTaskConfig(config);
  }, [config, setLastTaskConfig]);

  if (!task || !Runner || !config) {
    return <div className="p-10">Unable to load task</div>;
  }

  const onFinish = (payload) => {
    const durationMs = Date.now() - startTime;
    const session = {
      taskId,
      config: payload.config,
      trials: payload.trials,
      summary: payload.summary,
      attempts: payload.attempts,
      durationMs,
    };
    if (!config.practice) {
      addSession(session);
      toast.success("Session saved");
    } else {
      toast("Practice run — not saved");
    }
    setResult(session);
  };

  const onExit = () => {
    if (result) nav("/");
    else if (window.confirm("Exit session? Progress will be lost.")) nav("/");
  };

  if (result) {
    return <SessionSummary session={result} onDone={() => nav("/")} onRepeat={() => { setResult(null); nav(`/tasks/${taskId}`, { state: { config } }); }} />;
  }

  return <Runner config={config} onFinish={onFinish} onExit={onExit} />;
}
