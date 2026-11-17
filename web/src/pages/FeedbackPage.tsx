import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { when } from "../format";

type Note = components["schemas"]["FeedbackView"];
const AREAS = ["General", "Clients", "Pipeline", "Brief", "Shortlist", "Professionals", "Tasks", "Discovery call", "Integrations", "Something missing"];

export function FeedbackPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [form, setForm] = useState({ author: "", area: "General", note: "" });
  const load = () => api.GET("/api/v1/feedback", { params: { query: { limit: 200 } } }).then(({ data }) => data && setNotes(data));
  useEffect(() => {
    void load();
  }, []);
  const add = async () => {
    await api.POST("/api/v1/feedback", { body: { author: form.author, area: form.area, note: form.note } });
    setForm({ ...form, note: "" });
    await load();
  };
  return (
    <>
      <div className="eyebrow">Trial</div>
      <h1>Feedback</h1>
      <p className="muted">What worked, what was confusing, what was missing. This is test data only, and notes stay on this machine.</p>
      <section className="panel form">
        <div className="two">
          <label>Your name<input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
          <label>About<select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select></label>
        </div>
        <label>What did you notice?<textarea rows={3} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        <div><button className="button primary" disabled={!form.note.trim()} onClick={() => void add()}>Save note</button></div>
      </section>
      <section className="panel">
        <h2>{notes.length} note{notes.length === 1 ? "" : "s"}</h2>
        <ul className="plain history">
          {notes.map((n) => (
            <li key={n.id}>
              <span><span className="pill">{n.area || "General"}</span> {n.note}</span>
              <span className="muted">{n.author || "Anonymous"} · {when(n.created_at)}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
