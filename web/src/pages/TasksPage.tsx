import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { TaskRows } from "./TasksPanel";

type Task = components["schemas"]["TaskView"];
type Summary = components["schemas"]["TaskSummary"];

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [state, setState] = useState("open");
  const load = useCallback(() => {
    api.GET("/api/v1/tasks", { params: { query: { state } } }).then(({ data }) => data && setTasks(data));
    api.GET("/api/v1/tasks/summary").then(({ data }) => data && setSummary(data));
  }, [state]);
  useEffect(load, [load]);
  return (
    <>
      <div className="eyebrow">Tasks</div>
      <h1>What needs doing</h1>
      {summary && (
        <div className="stats">
          <div className="stat"><b>{summary.open}</b><span>open</span></div>
          <div className={`stat ${summary.overdue ? "bad" : ""}`}><b>{summary.overdue}</b><span>overdue</span></div>
          <div className="stat"><b>{summary.due_today}</b><span>due today</span></div>
        </div>
      )}
      <div className="acts">
        {["open", "done", "all"].map((s) => (
          <button key={s} className={s === state ? "primary" : ""} onClick={() => setState(s)}>{s}</button>
        ))}
      </div>
      <section className="panel"><TaskRows tasks={tasks} reload={load} /></section>
    </>
  );
}
