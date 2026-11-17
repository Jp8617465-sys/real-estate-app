import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { when } from "../format";

type Comm = components["schemas"]["CommunicationView"];
type Channel = "email" | "call" | "sms" | "note";

export function CallPanel({ engagementId, onChanged }: { engagementId: string; onChanged: () => void }) {
  const [slots, setSlots] = useState<{ attendees: string[]; slots: { start: string }[] } | null>(null);
  const [booked, setBooked] = useState<components["schemas"]["CallBooked"] | null>(null);
  const [comms, setComms] = useState<Comm[]>([]);
  const [form, setForm] = useState({ direction: "in" as "in" | "out", channel: "email" as Channel, subject: "", body: "" });
  const path = { params: { path: { engagement_id: engagementId } } };

  const load = useCallback(() => {
    api.GET("/api/v1/engagements/{engagement_id}/communications", path).then(({ data }) => data && setComms(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);
  useEffect(load, [load]);

  const propose = async () => {
    const { data } = await api.POST("/api/v1/engagements/{engagement_id}/discovery-call/slots", path);
    if (data) setSlots({ attendees: data.attendees, slots: data.slots as { start: string }[] });
  };
  const book = async (start: string) => {
    const { data } = await api.POST("/api/v1/engagements/{engagement_id}/discovery-call/book", { ...path, body: { start } });
    if (data) {
      setBooked(data);
      setSlots(null);
      load();
      onChanged();
    }
  };
  const log = async () => {
    await api.POST("/api/v1/engagements/{engagement_id}/communications", { ...path, body: { direction: form.direction, channel: form.channel, subject: form.subject.trim(), body: form.body || null } });
    setForm({ ...form, subject: "", body: "" });
    load();
    onChanged();
  };

  return (
    <section className="panel">
      <h2>Book a discovery call</h2>
      <p className="warnbox">Synthetic calendar: times come from an invented diary and nothing is sent. No mail or calendar account is connected.</p>
      {!slots && <button className="button primary" onClick={() => void propose()}>Propose times</button>}
      {slots && (
        <>
          <p className="muted">Invite to: {slots.attendees.join(", ") || "no client email on record"}</p>
          <div className="acts">
            {slots.slots.map((s) => (
              <button key={s.start} onClick={() => void book(s.start)}>{when(s.start)}</button>
            ))}
          </div>
        </>
      )}
      {booked && (
        <p className="message">
          Booked for {when(booked.start)}. Stage is now {booked.stage}, and a task was added.{" "}
          <a download="discovery-call.ics" href={`data:text/calendar;charset=utf-8,${encodeURIComponent(booked.invite_ics)}`}>Download the invitation (.ics)</a>
        </p>
      )}
      <div className="group">Emails, calls and notes</div>
      <ul className="plain">
        {comms.map((c) => (
          <li key={c.id}>
            <span className="pill">{c.channel} {c.direction === "in" ? "in" : "out"}</span> <strong>{c.subject}</strong>
            <div className="muted small">{when(c.occurred_at)}{c.body ? ` · ${c.body}` : ""}</div>
          </li>
        ))}
        {comms.length === 0 && <li className="muted">Nothing logged yet.</li>}
      </ul>
      <div className="edit">
        <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })} aria-label="Channel">
          {["email", "call", "sms", "note"].map((c) => <option key={c}>{c}</option>)}
        </select>
        <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value as "in" | "out" })} aria-label="Direction">
          <option value="in">received</option>
          <option value="out">sent</option>
        </select>
        <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Subject or summary" aria-label="Subject" />
        <button className="button" disabled={!form.subject.trim()} onClick={() => void log()}>Log it</button>
      </div>
    </section>
  );
}
