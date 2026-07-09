import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import Shell from "./components/layout/Shell";
import Home from "./pages/Home";
import TasksIndex from "./pages/TasksIndex";
import TaskLauncher from "./pages/TaskLauncher";
import TaskRunner from "./pages/TaskRunner";
import Analytics from "./pages/Analytics";
import Sessions from "./pages/Sessions";
import Presets from "./pages/Presets";
import Goals from "./pages/Goals";
import Settings from "./pages/Settings";
import { AppProvider } from "./lib/store";

export default function App() {
  return (
    <AppProvider>
      <div className="App">
        <BrowserRouter>
          <Routes>
            <Route element={<Shell />}>
              <Route index element={<Home />} />
              <Route path="tasks" element={<TasksIndex />} />
              <Route path="tasks/:taskId" element={<TaskLauncher />} />
              <Route path="analytics" element={<Analytics />} />
              <Route path="sessions" element={<Sessions />} />
              <Route path="presets" element={<Presets />} />
              <Route path="goals" element={<Goals />} />
              <Route path="settings" element={<Settings />} />
              <Route path="run/:taskId" element={<TaskRunner />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <Toaster theme="dark" position="bottom-right" richColors closeButton />
      </div>
    </AppProvider>
  );
}
