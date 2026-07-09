// Central task registry. Every task registers here so pages/analytics work generically.
// Adding a new task = drop a folder + import + register.

import nback from "./nback/module";
import pasat from "./pasat/module";
import memorySpan from "./memorySpan/module";
import taskSwitching from "./taskSwitching/module";
import ospan from "./ospan/module";
import corsi from "./corsi/module";

export const TASKS = {
  [nback.id]: nback,
  [pasat.id]: pasat,
  [memorySpan.id]: memorySpan,
  [taskSwitching.id]: taskSwitching,
  [ospan.id]: ospan,
  [corsi.id]: corsi,
};

export const TASK_LIST = Object.values(TASKS);

export function getTask(id) {
  return TASKS[id] || null;
}
