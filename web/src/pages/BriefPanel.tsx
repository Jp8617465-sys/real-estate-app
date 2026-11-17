import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";

type Brief = components["schemas"]["BriefView"];
type Field = components["schemas"]["BriefField"];

export function BriefPanel({ engagementId }: { engagementId: string }) {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [subjects, setSubjects] = useState<Record<string, string>>({});
  const [note, setNote] = useState<string | null>(null);
  const path = { params: { path: { engagement_id: engagementId } } };

  const load = useCallback(() => {
    api.GET("/api/engagements/{engagement_id}/brief", path).then(({ data }) => data && setBrief(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);
  useEffect(load, [load]);

  const apply = (r: { data?: Brief; error?: unknown }) => {
    if (r.data) {
      setBrief(r.data);
      setNote(null);
    } else setNote(String((r.error as { detail?: unknown } | undefined)?.detail ?? "That was refused."));
  };

  const save = async (f: Field) => {
    const value = (drafts[f.id] ?? "").trim();
    if (!value) return;
    const subject = f.per_person ? subjects[f.id] || null : null;
    const r =
      f.kind === "one"
        ? await api.PUT("/api/engagements/{engagement_id}/brief/{field_id}", { params: { path: { engagement_id: engagementId, field_id: f.id } }, body: { value, subject } })
        : await api.POST("/api/engagements/{engagement_id}/brief/{field_id}/values", { params: { path: { engagement_id: engagementId, field_id: f.id } }, body: { value, subject } });
    apply(r);
    if (r.data) setDrafts({ ...drafts, [f.id]: "" });
  };

  const remove = async (valueId: string) => {
    apply(await api.DELETE("/api/engagements/{engagement_id}/brief/values/{value_id}", { params: { path: { engagement_id: engagementId, value_id: valueId } } }));
  };

  if (!brief) return null;
  return (
    <section className="panel">
      <h2>Buyer brief</h2>
      <p className="muted">
        Type a value or let a discovery call fill it. Each value shows where it came from; replaced values stay in its history.
      </p>
      {note && <p className="error">{note}</p>}
      {brief.not_covered.length > 0 && (
        <details>
          <summary>{brief.not_covered.length} fields not covered yet</summary>
          <p className="muted">{brief.not_covered.join(" · ")}</p>
        </details>
      )}
      {brief.sections.map((s) => (
        <div key={s.key}>
          <div className="group">{s.label}</div>
          {s.fields.map((f) => (
            <div className="kv" key={f.id}>
              <div className="k">{f.label}</div>
              {f.values.map((v, i) => (
                <div key={v.id ?? i} className="briefvalue">
                  <div>
                    {v.subject ? <span className="pill">{v.subject}</span> : null} {v.value}
                    {v.id && f.kind === "many" && (
                      <button className="linkbtn" onClick={() => void remove(v.id!)} aria-label={`Remove ${v.value}`}>
                        remove
                      </button>
                    )}
                  </div>
                  <div className="src">{v.status === "discuss" ? "To discuss · " : ""}{v.source}</div>
                  {v.history.map((h) => (
                    <div className="was" key={h.value + h.source}>
                      Earlier: {h.value} ({h.source})
                    </div>
                  ))}
                </div>
              ))}
              <div className="edit">
                {f.per_person && <input className="narrow" placeholder="Who" value={subjects[f.id] ?? ""} onChange={(e) => setSubjects({ ...subjects, [f.id]: e.target.value })} aria-label={`${f.label}: person`} />}
                <input
                  placeholder={f.kind === "one" ? (f.values.length ? "Replace…" : "Set…") : "Add…"}
                  value={drafts[f.id] ?? ""}
                  onChange={(e) => setDrafts({ ...drafts, [f.id]: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && void save(f)}
                  aria-label={f.label}
                />
                <button className="button" disabled={!(drafts[f.id] ?? "").trim()} onClick={() => void save(f)}>
                  {f.kind === "one" ? "Save" : "Add"}
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  );
}
