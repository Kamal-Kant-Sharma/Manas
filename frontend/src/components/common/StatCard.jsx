import React from "react";

export default function StatCard({ label, value, sub, accent = "text-foreground", testId }) {
  return (
    <div className="border border-border bg-card p-5 rounded-sm hover-card-lift" data-testid={testId}>
      <div className="overline">{label}</div>
      <div className={`metric text-3xl mt-3 ${accent}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-2">{sub}</div>}
    </div>
  );
}
