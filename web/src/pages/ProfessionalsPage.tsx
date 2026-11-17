import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { duplicateOf } from "./PeoplePage";

type Pro = components["schemas"]["ProSummary"];
type Kind = components["schemas"]["ProfessionalProfile"]["kind"];

export const KINDS: Kind[] = ["broker", "selling_agent", "conveyancer", "solicitor", "inspector", "referrer", "other"];
export const kindLabel = (k: string) => k.replace("_", " ");

export function ProfessionalsPage() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [pros, setPros] = useState<Pro[]>([]);
  const [form, setForm] = useState({ name: "", kind: "broker" as Kind, firm: "", email: "", mobile: "" });
  const [dup, setDup] = useState<ReturnType<typeof duplicateOf>>(null);

  const load = () =>
    api.GET("/api/v1/professionals", { params: { query: { q: q || undefined, kind: kind || undefined } } }).then(({ data }) => data && setPros(data));
  useEffect(() => {
    const t = setTimeout(() => void load(), 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, kind]);

  const add = async (confirm: boolean) => {
    const { data, error } = await api.POST("/api/v1/professionals", {
      body: { name: form.name.trim(), kind: form.kind, firm: form.firm || null, email: form.email || null, mobile: form.mobile || null, confirm_duplicate: confirm },
    });
    const d = duplicateOf(error);
    if (d) return setDup(d);
    setDup(null);
    if (data) {
      setForm({ name: "", kind: "broker", firm: "", email: "", mobile: "" });
      await load();
    }
  };

  return (
    <>
      <div className="eyebrow">Professionals</div>
      <h1>Brokers, agents and partners</h1>
      <p className="muted">One agency-wide record per person, reused on every engagement they work on.</p>
      <div className="two">
        <label className="search">
          Find by name or firm
          <input value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <label className="search">
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">All</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>{kindLabel(k)}</option>
            ))}
          </select>
        </label>
      </div>
      <ul className="rows">
        {pros.map((p) => (
          <li key={p.id}>
            <Link className="row" to={`/people/${p.id}`}>
              <span className="row-main">
                <strong>{p.name}</strong>
                <span className="muted">{[p.firm, p.email, p.mobile].filter(Boolean).join(" · ") || "No details"}</span>
              </span>
              <span className="pill">{kindLabel(p.kind)}</span>
              <span className="muted">{p.engagement_count} engagement{p.engagement_count === 1 ? "" : "s"}</span>
            </Link>
          </li>
        ))}
        {pros.length === 0 && <li className="muted">No one yet.</li>}
      </ul>
      <section className="panel form">
        <h2>Add a professional</h2>
        <div className="two">
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Kind<select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>{KINDS.map((k) => <option key={k} value={k}>{kindLabel(k)}</option>)}</select></label>
        </div>
        <label>Firm<input value={form.firm} onChange={(e) => setForm({ ...form, firm: e.target.value })} /></label>
        <div className="two">
          <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label>Mobile<input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
        </div>
        {dup && (
          <div className="warnbox" role="alert">
            {dup.message}
            <ul className="plain">{dup.matches.map((m) => <li key={m.id}><Link to={`/people/${m.id}`}>{m.name}</Link></li>)}</ul>
            <button className="button" onClick={() => void add(true)}>This is a different person: add anyway</button>
          </div>
        )}
        <div><button className="button primary" disabled={!form.name.trim()} onClick={() => void add(false)}>Add professional</button></div>
      </section>
    </>
  );
}
