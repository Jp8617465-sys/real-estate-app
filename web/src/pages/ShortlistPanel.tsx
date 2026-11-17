import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { money } from "../format";

type Shortlist = components["schemas"]["ShortlistView"];
type Row = components["schemas"]["EngagementProperty"];
type Status = components["schemas"]["AttachProperty"]["status"];

const STATUSES: Status[] = ["considering", "shortlisted", "inspecting", "held", "offered", "purchased", "passed", "missed"];
const RESULTS = ["meets", "partly", "fails", "unknown"] as const;
const FIT_TEXT: Record<string, string> = { within: "within budget", stretch: "a stretch on budget", over: "over budget", unknown: "budget fit unknown" };

export function ShortlistPanel({ engagementId }: { engagementId: string }) {
  const [list, setList] = useState<Shortlist | null>(null);
  const [form, setForm] = useState({ address_line: "", suburb: "", bedrooms: "", low: "", high: "" });
  const [note, setNote] = useState<string | null>(null);
  const [criterion, setCriterion] = useState<Record<string, string>>({});
  const [drive, setDrive] = useState<Record<string, string>>({});
  const [driveResult, setDriveResult] = useState<Record<string, string>>({});
  const [enriched, setEnriched] = useState<Record<string, string>>({});
  const path = { params: { path: { engagement_id: engagementId } } };

  const load = useCallback(() => {
    api.GET("/api/v1/engagements/{engagement_id}/properties", { ...path, params: { ...path.params, query: {} } }).then(({ data }) => data && setList(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);
  useEffect(load, [load]);

  const enrich = async (r: Row) => {
    const { data, error } = await api.POST("/api/v1/properties/{property_id}/enrich", { params: { path: { property_id: r.property.id } } });
    setEnriched({ ...enriched, [r.id]: data ? `Synthetic data: filled ${data.filled.join(", ") || "nothing"}; kept what you entered (${data.kept.join(", ") || "none"}); not available: ${data.not_available.join(", ") || "none"}.` : String((error as { detail?: unknown })?.detail ?? "No data for that address.") });
    load();
  };
  const driveTime = async (r: Row) => {
    const { data } = await api.GET("/api/v1/integrations/maps/drive-time", { params: { query: { from_place: r.property.suburb ?? "", to_place: drive[r.id] ?? "" } } });
    setDriveResult({ ...driveResult, [r.id]: data ? (data.minutes == null ? "Unknown place" : `About ${data.minutes} minutes by car (synthetic estimate)`) : "" });
  };
  const num = (s: string) => (s.trim() ? Number(s.replace(/[$,]/g, "")) : null);

  const add = async (confirm: boolean) => {
    setNote(null);
    const created = await api.POST("/api/v1/properties", {
      body: {
        address_line: form.address_line.trim(), suburb: form.suburb.trim() || null, bedrooms: num(form.bedrooms),
        price_guide_low: num(form.low), price_guide_high: num(form.high), confirm_duplicate: confirm,
      },
    });
    const dup = (created.error as { detail?: { matches?: { id: string }[]; message?: string } } | undefined)?.detail;
    if (!created.data && dup?.matches) {
      setNote(`${dup.message} `);
      const existing = dup.matches[0]?.id ?? "";
      await api.POST("/api/v1/engagements/{engagement_id}/properties", { ...path, body: { property_id: existing, status: "considering" } });
    } else if (created.data) {
      await api.POST("/api/v1/engagements/{engagement_id}/properties", { ...path, body: { property_id: created.data.id, status: "considering" } });
    }
    setForm({ address_line: "", suburb: "", bedrooms: "", low: "", high: "" });
    load();
  };

  const patch = async (r: Row, body: { status?: Status; assessment?: string; reasons?: string }) => {
    await api.PATCH("/api/v1/engagements/{engagement_id}/properties/{ep_id}", { params: { path: { engagement_id: engagementId, ep_id: r.id } }, body });
    load();
  };

  const check = async (r: Row, name: string, result: (typeof RESULTS)[number]) => {
    await api.PUT("/api/v1/engagements/{engagement_id}/properties/{ep_id}/checks", {
      params: { path: { engagement_id: engagementId, ep_id: r.id } },
      body: { criterion: name, result },
    });
    load();
  };

  if (!list) return null;
  return (
    <section className="panel">
      <h2>Properties and shortlist</h2>
      <p className="muted">Unknown stays unknown. Check each property against the brief, then decide.</p>
      {note && <p className="warnbox">{note}It was added from the existing record.</p>}
      {list.properties.map((r) => (
        <div className="card" key={r.id}>
          <div className="fieldname">
            {[r.property.suburb, r.property.bedrooms != null ? `${r.property.bedrooms} bed` : null, r.property.price_guide_low != null ? `${money(r.property.price_guide_low)}${r.property.price_guide_high ? `–${money(r.property.price_guide_high)}` : ""}` : "price unknown"].filter(Boolean).join(" · ")}
          </div>
          <div className="value">{r.property.address_line}</div>
          <div className="pills">
            <span className={`pill ${r.budget_fit === "over" ? "bad" : r.budget_fit === "stretch" ? "warn" : ""}`}>{FIT_TEXT[r.budget_fit]}</span>
            <span className="pill plain">
              fit: {r.fit.meets} meets · {r.fit.partly} partly · {r.fit.fails} fails · {r.fit.unknown} unknown
            </span>
          </div>
          <div className="edit">
            <button className="button" onClick={() => void enrich(r)}>Look up details (synthetic data)</button>
            <input className="narrow" value={drive[r.id] ?? ""} onChange={(e) => setDrive({ ...drive, [r.id]: e.target.value })} placeholder="Drive to… (suburb)" aria-label="Drive time to" />
            <button className="button" disabled={!r.property.suburb || !(drive[r.id] ?? "").trim()} onClick={() => void driveTime(r)}>Drive time</button>
          </div>
          {enriched[r.id] && <p className="hint">{enriched[r.id]}</p>}
          {driveResult[r.id] && <p className="hint">{driveResult[r.id]}</p>}
          <div className="acts">
            {STATUSES.map((s) => (
              <button key={s} className={s === r.status ? "primary" : ""} disabled={s === r.status} onClick={() => void patch(r, { status: s })}>
                {s}
              </button>
            ))}
          </div>
          {r.checks.map((c) => (
            <div className="check" key={c.id}>
              <span>{c.criterion}</span>
              <span className="acts">
                {RESULTS.map((x) => (
                  <button key={x} className={x === c.result ? (x === "fails" ? "danger" : "primary") : ""} onClick={() => void check(r, c.criterion, x)}>
                    {x}
                  </button>
                ))}
              </span>
            </div>
          ))}
          <div className="edit">
            <input value={criterion[r.id] ?? ""} onChange={(e) => setCriterion({ ...criterion, [r.id]: e.target.value })} placeholder="Add a criterion to check…" list={`crit-${r.id}`} aria-label="Criterion" />
            <datalist id={`crit-${r.id}`}>
              {list.suggested_criteria.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <button className="button" disabled={!(criterion[r.id] ?? "").trim()} onClick={() => { void check(r, (criterion[r.id] ?? "").trim(), "unknown"); setCriterion({ ...criterion, [r.id]: "" }); }}>
              Add
            </button>
          </div>
          <label className="stack">
            Assessment
            <textarea defaultValue={r.assessment ?? ""} rows={2} onBlur={(e) => e.target.value !== (r.assessment ?? "") && void patch(r, { assessment: e.target.value })} />
          </label>
          <label className="stack">
            Reasons for the decision
            <textarea defaultValue={r.reasons ?? ""} rows={2} onBlur={(e) => e.target.value !== (r.reasons ?? "") && void patch(r, { reasons: e.target.value })} />
          </label>
        </div>
      ))}
      <div className="group">Add a property</div>
      <div className="form">
        <div className="two">
          <label>Address (a partial address is fine)<input value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} /></label>
          <label>Suburb<input value={form.suburb} onChange={(e) => setForm({ ...form, suburb: e.target.value })} /></label>
        </div>
        <div className="two">
          <label>Bedrooms of this property<input value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} /></label>
          <label>Price guide low / high<span className="edit"><input value={form.low} onChange={(e) => setForm({ ...form, low: e.target.value })} aria-label="Price guide low" /><input value={form.high} onChange={(e) => setForm({ ...form, high: e.target.value })} aria-label="Price guide high" /></span></label>
        </div>
        <div><button className="button primary" disabled={!form.address_line.trim()} onClick={() => void add(false)}>Add to this engagement</button></div>
      </div>
    </section>
  );
}
