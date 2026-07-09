// Central task registry. Every task registers here so pages/analytics work generically.
// Adding a new task = drop a folder + import + register.

import nback from "./nback/module";
import pasat from "./pasat/module";
import memorySpan from "./memorySpan/module";

export const TASKS = {
  [nback.id]: nback,
  [pasat.id]: pasat,
  [memorySpan.id]: memorySpan,
};

export const TASK_LIST = Object.values(TASKS);

export function getTask(id) {
  return TASKS[id] || null;
}
