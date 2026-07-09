import React, { useState, useMemo, useRef } from "react";
import { Trash2, Download, Upload, RotateCcw, Search } from "lucide-react";
import PageHeader from "../components/common/PageHeader";
import EmptyState from "../components/common/EmptyState";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { useApp } from "../lib/store";
import { TASK_LIST, getTask } from "../tasks/registry";
import { pct, ms as fms, relativeTime, ymd } from "../lib/format";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { toast } from "sonner";

export default function Sessions() {
  const { sessions, deleteSession, trash, restoreSession, purgeTrash, exportAll, importAll } = useApp();
  const [query, setQuery] = useState("");
  const [taskFilter, setTaskFilter] = useState("all");
  const [showTrash, setShowTrash] = useState(false);
  const [detail, setDetail] = useState(null);
  const fileRef = useRef(null);

  const list = useMemo(() => {
    return sessions.filter((s) => {
      const okTask = taskFilter === "all" || s.taskId === taskFilter;
      const okQuery = !query || (getTask(s.taskId)?.name || "").toLowerCase().includes(query.toLowerCase())
        || getTask(s.taskId)?.describeConfig(s.config).toLowerCase().includes(query.toLowerCase());
      return okTask && okQuery;
    });
  }, [sessions, query, taskFilter]);

  const doExport = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neuroforge-export-${ymd(new Date().toISOString())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const exportCSV = () => {
    const rows = [
      ["id","taskId","createdAt","accuracy","f1","precision","recall","meanRt","medianRt","durationMs","config"],
      ...sessions.map((s) => [
        s.id, s.taskId, s.createdAt,
        s.summary?.metrics?.accuracy ?? "",
        s.summary?.metrics?.f1 ?? "",
        s.summary?.metrics?.precision ?? "",
        s.summary?.metrics?.recall ?? "",
        s.summary?.rt?.mean ?? "",
        s.summary?.rt?.median ?? "",
        s.durationMs ?? "",
        JSON.stringify(s.config).replace(/"/g, '""'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `neuroforge-sessions-${ymd(new Date().toISOString())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  const onImportFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const ok = importAll(data);
        toast[ok ? "success" : "error"](ok ? "Imported" : "Invalid file");
      } catch { toast.error("Could not parse file"); }
    };
    reader.readAsText(f);
  };

  return (
    <div>
      <PageHeader
        eyebrow="sessions"
        title="Session Log"
        description={`${sessions.length} saved · ${trash.length} in trash`}
        actions={
          <>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} data-testid="import-input" />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} data-testid="import-btn"><Upload className="w-4 h-4 mr-1.5" strokeWidth={1.5} />Import</Button>
            <Button variant="outline" size="sm" onClick={doExport} data-testid="export-json-btn"><Download className="w-4 h-4 mr-1.5" strokeWidth={1.5} />JSON</Button>
            <Button variant="outline" size="sm" onClick={exportCSV} data-testid="export-csv-btn"><Download className="w-4 h-4 mr-1.5" strokeWidth={1.5} />CSV</Button>
            <Button variant={showTrash ? "default" : "ghost"} size="sm" onClick={() => setShowTrash((v) => !v)} data-testid="toggle-trash-btn"><Trash2 className="w-4 h-4 mr-1.5" strokeWidth={1.5} />Trash</Button>
          </>
        }
      />
      <div className="p-6 md:p-10 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="overline mb-1">search</div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter…" className="pl-9" data-testid="sessions-search" />
            </div>
          </div>
          <div className="min-w-[180px]">
            <div className="overline mb-1">task</div>
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tasks</SelectItem>
                {TASK_LIST.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {showTrash ? (
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="overline">trash · {trash.length}</div>
              {trash.length > 0 && <Button size="sm" variant="destructive" onClick={() => { purgeTrash(); toast.success("Trash purged"); }} data-testid="purge-trash-btn">Empty trash</Button>}
            </div>
            {trash.length === 0 ? (
              <EmptyState icon={Trash2} title="Trash is empty" description="Deleted sessions can be restored from here." />
            ) : (
              <div className="border border-border rounded-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="border-b border-border bg-secondary/40">
                    <tr>
                      <th className="text-left overline p-3">task</th>
                      <th className="text-left overline p-3">config</th>
                      <th className="text-right overline p-3">deleted</th>
                      <th className="text-right overline p-3">action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trash.map((s) => (
                      <tr key={s.id} className="border-b border-border">
                        <td className="p-3 font-display">{getTask(s.taskId)?.name || s.taskId}</td>
                        <td className="p-3 text-xs text-muted-foreground">{getTask(s.taskId)?.describeConfig(s.config)}</td>
                        <td className="p-3 text-right text-xs text-muted-foreground">{relativeTime(s.deletedAt)}</td>
                        <td className="p-3 text-right">
                          <Button size="sm" variant="outline" onClick={() => restoreSession(s.id)} data-testid={`restore-${s.id}`}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />Restore
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : list.length === 0 ? (
          <EmptyState icon={Trash2} title="No sessions match" description="Adjust your filters or run a new task." />
        ) : (
          <div className="border border-border rounded-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="text-left overline p-3">task</th>
                  <th className="text-left overline p-3 hidden md:table-cell">config</th>
                  <th className="text-right overline p-3">accuracy</th>
                  <th className="text-right overline p-3 hidden md:table-cell">rt</th>
                  <th className="text-right overline p-3">when</th>
                  <th className="text-right overline p-3">action</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const t = getTask(s.taskId);
                  return (
                    <tr key={s.id} className="border-b border-border hover:bg-secondary/40" style={{ transitionProperty: "background-color", transitionDuration: "150ms" }}>
                      <td className="p-3 font-display cursor-pointer" onClick={() => setDetail(s)}>
                        <span className="inline-block w-1.5 h-1.5 rounded-full mr-2" style={{ background: t?.color }} />
                        {t?.name || s.taskId}
                      </td>
                      <td className="p-3 text-xs text-muted-foreground hidden md:table-cell">{t?.describeConfig(s.config)}</td>
                      <td className="p-3 text-right metric">{pct(s.summary?.metrics?.accuracy)}</td>
                      <td className="p-3 text-right metric hidden md:table-cell">{fms(s.summary?.rt?.mean)}</td>
                      <td className="p-3 text-right text-xs text-muted-foreground">{relativeTime(s.createdAt)}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" onClick={() => { deleteSession(s.id); toast.success("Deleted"); }} data-testid={`delete-${s.id}`}>
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">{detail && (getTask(detail.taskId)?.name || detail.taskId)} · Session detail</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4">
              <div className="text-xs text-muted-foreground">{new Date(detail.createdAt).toLocaleString()}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <MiniStat label="Accuracy" value={pct(detail.summary?.metrics?.accuracy)} />
                <MiniStat label="F1" value={Number.isFinite(detail.summary?.metrics?.f1) ? detail.summary.metrics.f1.toFixed(3) : "—"} />
                <MiniStat label="Mean RT" value={fms(detail.summary?.rt?.mean)} />
                <MiniStat label="Trials" value={detail.summary?.totalTrials ?? "—"} />
              </div>
              <div>
                <div className="overline mb-1">config</div>
                <pre className="font-mono text-[11px] p-3 border border-border rounded-sm bg-input overflow-auto max-h-64">{JSON.stringify(detail.config, null, 2)}</pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="border border-border rounded-sm p-2">
      <div className="overline">{label}</div>
      <div className="metric text-lg mt-0.5">{value}</div>
    </div>
  );
}
