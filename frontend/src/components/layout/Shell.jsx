import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, BarChart3, Bookmark, FlaskConical, Home, Settings2, Target, Trash2 } from "lucide-react";
import { useApp } from "../../lib/store";

const NAV = [
  { to: "/", icon: Home, label: "Dashboard", exact: true, testId: "nav-dashboard" },
  { to: "/tasks", icon: FlaskConical, label: "Tasks", testId: "nav-tasks" },
  { to: "/analytics", icon: BarChart3, label: "Analytics", testId: "nav-analytics" },
  { to: "/sessions", icon: Activity, label: "Sessions", testId: "nav-sessions" },
  { to: "/presets", icon: Bookmark, label: "Presets", testId: "nav-presets" },
  { to: "/goals", icon: Target, label: "Goals", testId: "nav-goals" },
  { to: "/settings", icon: Settings2, label: "Settings", testId: "nav-settings" },
];

export default function Shell() {
  const { sessions, profile } = useApp();
  const location = useLocation();
  const isRunner = location.pathname.startsWith("/run/");

  if (isRunner) {
    // Immersive runner has no chrome
    return (
      <div className="min-h-screen">
        <Outlet />
      </div>
    );
  }

  return (
    <div className="min-h-screen grain flex" data-testid="app-shell">
      {/* Sidebar */}
      <aside className="hidden md:flex md:w-60 shrink-0 flex-col border-r border-border bg-card/40 sticky top-0 h-screen z-10">
        <div className="px-5 py-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-sm bg-primary/20 border border-primary/40 grid place-items-center">
              <FlaskConical className="w-4 h-4 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <div className="font-display text-base leading-none">neuroforge</div>
              <div className="overline mt-1">v0.1 / lab</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.exact}
              data-testid={n.testId}
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 px-5 py-2 text-sm border-l-2",
                  isActive
                    ? "border-primary text-foreground bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/40",
                ].join(" ")
              }
              style={{ transitionProperty: "color, background-color", transitionDuration: "150ms" }}
            >
              <n.icon className="w-4 h-4" strokeWidth={1.5} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-border">
          <div className="overline">profile</div>
          <div className="mt-1 text-sm font-medium">{profile.name}</div>
          <div className="text-xs text-muted-foreground mt-1 metric">{sessions.length} sessions</div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 relative z-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between border-b border-border px-4 py-3 bg-card/40">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="font-display text-sm">neuroforge</span>
          </div>
          <div className="overline">{sessions.length} sess</div>
        </div>
        <div className="md:hidden overflow-x-auto border-b border-border">
          <div className="flex gap-1 px-2 py-2 min-w-max">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.exact}
                data-testid={`m-${n.testId}`}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-sm border",
                    isActive
                      ? "border-primary text-primary bg-primary/5"
                      : "border-border text-muted-foreground",
                  ].join(" ")
                }
              >
                <n.icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>{n.label}</span>
              </NavLink>
            ))}
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
