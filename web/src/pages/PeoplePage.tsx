import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";

type Summary = components["schemas"]["PersonSummary"];

type Duplicate = { message: string; matches: Summary[] };

export function duplicateOf(error: unknown): Duplicate | null {
  const d = (error as { detail?: unknown } | undefined)?.detail;
  return d && typeof d === "object" && "matches" in d ? (d as Duplicate) : null;
}

export function PeoplePage() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<Summary[]>([]);
  const [form, setForm] = useState({ name: "", email: "", mobile: "" });
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => {
      api.GET("/api/people", { params: { query: { q: q || undefined } } }).then(({ data }) => data && setPeople(data));
    }, 150);
    return () => clearTimeout(t);
  }, [q]);

  const create = async (confirm: boolean) => {
    setError(null);
    const { data, error: failed } = await api.POST("/api/people", {
      body: {
        name: form.name.trim(),
        email: form.email.trim() || null,
        mobile: form.mobile.trim() || null,
        confirm_duplicate: confirm,
      },
    });
    if (data) return navigate(`/people/${data.id}`);
    const dup = duplicateOf(failed);
    if (dup) return setDuplicate(dup);
    setError("That could not be saved. A name is required.");
  };

  return (
    <>
      <div className="eyebrow">Clients</div>
      <h1>Clients and households</h1>
      <label className="search">
        Find a client by name, email or mobile
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing…" autoFocus />
      </label>
      <ul className="rows">
        {people.map((p) => (
          <li key={p.id}>
            <Link className="row" to={`/people/${p.id}`}>
              <span className="row-main">
                <strong>{p.name}</strong>
                <span className="muted">{[p.email, p.mobile].filter(Boolean).join(" · ") || "No contact details"}</span>
              </span>
              <span className="pill">{p.household_names.join(", ") || "No household"}</span>
              <span />
            </Link>
          </li>
        ))}
        {people.length === 0 && <li className="muted">{q ? "No one matches that." : "No clients yet. Add the first below."}</li>}
      </ul>
      <section className="panel form">
        <h2>Add a client</h2>
        <label>
          Name
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <div className="two">
          <label>
            Email
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label>
            Mobile
            <input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
          </label>
        </div>
        {duplicate && (
          <div className="warnbox" role="alert">
            <strong>Possible duplicate.</strong> {duplicate.message}
            <ul className="plain">
              {duplicate.matches.map((m) => (
                <li key={m.id}>
                  <Link to={`/people/${m.id}`}>{m.name}</Link> <span className="muted">{[m.email, m.mobile].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
            <button className="button" onClick={() => void create(true)}>
              This is a different person: add anyway
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
        <div>
          <button className="button primary" disabled={!form.name.trim()} onClick={() => void create(false)}>
            Add client
          </button>
        </div>
      </section>
    </>
  );
}
