import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { when } from "../format";

type Task = components["schemas"]["TaskView"];

export function TaskRows({ tasks, reload }: { tasks: Task[]; reload: () => void }) {
  const toggle = async (t: Task) => {
    if (t.done_at) await api.POST("/api/tasks/{task_id}/reopen", { params: { path: { task_id: t.id } } });
    else await api.POST("/api/tasks/{task_id}/done", { params: { path: { task_id: t.id } } });
    reload();
  };
  return (
    <ul className="plain">
      {tasks.map((t) => (
        <li key={t.id} className="taskrow">
          <label>
            <input type="checkbox" checked={!!t.done_at} onChange={() => void toggle(t)} aria-label={`Done: ${t.title}`} />{" "}
            <span className={t.done_at ? "done" : ""}>{t.title}</span>
          </label>
          <span className="muted">
            {t.owner}
            {t.due_on ? ` · due ${t.due_on}` : t.due_text ? ` · ${t.due_text}` : ""}
            {t.household_name && <> · <Link to={`/engagements/${t.engagement_id}`}>{t.household_name}</Link></>}
          </span>
          {t.overdue && <span className="pill bad">overdue</span>}
        </li>
      ))}
      {tasks.length === 0 && <li className="muted">No tasks.</li>}
    </ul>
  );
}

export function TasksPanel({ engagementId }: { engagementId: string }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState({ title: "", owner: "Agent", due: "" });
  const [events, setEvents] = useState<components["schemas"]["TimelineEvent"][]>([]);
  const load = useCallback(() => {
    api.GET("/api/tasks", { params: { query: { engagement_id: engagementId } } }).then(({ data }) => data && setTasks(data));
    api.GET("/api/engagements/{engagement_id}/timeline", { params: { path: { engagement_id: engagementId } } }).then(({ data }) => data && setEvents(data));
  }, [engagementId]);
  useEffect(load, [load]);

  const add = async () => {
    await api.POST("/api/tasks", { body: { title: form.title.trim(), engagement_id: engagementId, owner: form.owner || "Agent", due_on: form.due || null } });
    setForm({ ...form, title: "", due: "" });
    load();
  };
  const fromCalls = async () => {
    await api.POST("/api/engagements/{engagement_id}/tasks/from-actions", { params: { path: { engagement_id: engagementId } } });
    load();
  };

  return (
    <>
      <section className="panel">
        <h2>Tasks</h2>
        <TaskRows tasks={tasks} reload={load} />
        <div className="edit">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="What needs doing?" aria-label="Task" onKeyDown={(e) => e.key === "Enter" && form.title.trim() && void add()} />
          <input className="narrow" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} aria-label="Owner" />
          <input className="narrow" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} aria-label="Due date" />
          <button className="button primary" disabled={!form.title.trim()} onClick={() => void add()}>Add task</button>
        </div>
        <p><button className="button" onClick={() => void fromCalls()}>Turn next actions from calls into tasks</button></p>
      </section>
      <section className="panel">
        <h2>Timeline</h2>
        <ul className="plain history">
          {events.map((e, i) => (
            <li key={i}>
              <span>{e.title}</span>
              <span className="muted">{when(e.at)}{e.source ? ` · ${e.source}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
