import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { money, stageLabel, when } from "../format";

type Engagement = components["schemas"]["Engagement"];
type Change = components["schemas"]["ChangeLogEntry"];
type Record = components["schemas"]["EngagementRecord"];
type IntakeSummary = components["schemas"]["IntakeSummary"];

const NOTICE =
  "Only synthetic or role-play material may be used while extraction runs on the global Claude API, outside Australia. Never upload a real client's conversation.";

const sourceLabel = (source: Change["source"]): string =>
  source["kind"] === "entered_by_hand"
    ? "Entered by hand"
    : source["kind"] === "call_intake"
      ? `${String(source["transcript"])} · ${String(source["speaker"] ?? "")} · ${String(source["decision"])}`
      : String(source["kind"]);

const valueLabel = (c: Change): string =>
  c.field.endsWith("_aud") ? money(Number(c.new_value)) : String(c.new_value);

function UploadCall({ engagementId }: { engagementId: string }) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async (filename: string, text: string, asNotes: boolean) => {
    setBusy(true);
    setError(null);
    const { data, error: failed } = await api.POST("/api/engagements/{engagement_id}/intakes", {
      params: { path: { engagement_id: engagementId } },
      body: { filename, text, notes: asNotes },
    });
    setBusy(false);
    if (data) navigate(`/intakes/${data.id}`);
    else setError(String((failed as { detail?: unknown } | undefined)?.detail ?? "That file could not be read."));
  };

  return (
    <section className="panel">
      <h2>Upload a discovery call</h2>
      <p className="warnbox">{NOTICE}</p>
      <div className="two">
        <label>
          Transcript (.vtt, .srt, .txt or .md)
          <input
            type="file"
            accept=".vtt,.srt,.txt,.md"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) await send(file.name, await file.text(), false);
            }}
          />
        </label>
        <label>
          Or paste your own call notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="One note per line. Unlabelled notes count as yours." />
        </label>
      </div>
      <button className="button primary" disabled={busy || !notes.trim()} onClick={() => send("Pasted notes", notes, true)}>
        Use these notes
      </button>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

const fieldLabel = (c: Change): string =>
  `${c.entity.charAt(0).toUpperCase()}${c.entity.slice(1)} ${c.field.replace(/_aud$/, "").replace(/_/g, " ")}`;

export function EngagementPage() {
  const { id = "" } = useParams();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
  const [record, setRecord] = useState<Record | null>(null);
  const [intakes, setIntakes] = useState<IntakeSummary[]>([]);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const params = { params: { path: { engagement_id: id } } };
    api.GET("/api/engagements/{engagement_id}", params).then(({ data }) => {
      if (data) setEngagement(data);
      else setMissing(true);
    });
    api.GET("/api/engagements/{engagement_id}/changes", params).then(({ data }) => {
      if (data) setChanges(data);
    });
    api.GET("/api/engagements/{engagement_id}/record", params).then(({ data }) => data && setRecord(data));
    api.GET("/api/engagements/{engagement_id}/intakes", params).then(({ data }) => data && setIntakes(data));
  }, [id]);

  if (missing) return <p className="muted">That engagement was not found.</p>;
  if (!engagement) return null;

  return (
    <>
      <div className="eyebrow">
        <Link to="/">Engagements</Link> / Buying
      </div>
      <div className="heading">
        <h1>{engagement.household_name}</h1>
        <span className="pill">{stageLabel(engagement.stage)}</span>
      </div>
      <div className="grid">
        <section className="panel">
          <h2>Clients</h2>
          <ul className="plain">
            {engagement.clients.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                <div className="muted">{[c.email, c.mobile].filter(Boolean).join(" · ")}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel">
          <h2>Buyer brief</h2>
          <p>
            <span className="muted">Budget</span> {money(engagement.budget_aud)}
          </p>
        </section>
      </div>
      <UploadCall engagementId={engagement.id} />
      {intakes.length > 0 && (
        <section className="panel">
          <h2>Discovery calls</h2>
          <ul className="plain">
            {intakes.map((i) => (
              <li key={i.id}>
                <Link to={`/intakes/${i.id}`}>{i.filename}</Link> <span className="pill">{stageLabel(i.stage)}</span>{" "}
                <span className="muted">{when(i.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {record && (record.values.length > 0 || record.professionals.length > 0) && (
        <section className="panel">
          <h2>What the calls recorded</h2>
          {record.sections.map(({ key, label }) => {
            const here = record.values.filter((v) => v.section === key);
            return here.length ? (
              <div key={key}>
                <div className="group">{label}</div>
                {here.map((v, i) => (
                  <div className="kv" key={`${v.field}-${i}`}>
                    <div className="k">
                      {v.label}
                      {v.subject ? ` · ${v.subject}` : ""} · {v.status}
                    </div>
                    <div>{v.value}</div>
                    <div className="src">{v.source}</div>
                    {v.earlier.map((e) => (
                      <div className="was" key={e.value}>
                        Earlier: {e.value} ({e.source})
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : null;
          })}
          {record.professionals.length > 0 && (
            <>
              <div className="group">Professionals</div>
              {record.professionals.map((p) => (
                <div className="kv" key={p.person_id}>
                  {p.name} <span className="muted">· {p.role}</span>
                </div>
              ))}
            </>
          )}
        </section>
      )}
      <section className="panel">
        <h2>Where each value came from</h2>
        <ul className="plain history">
          {changes.map((c, i) => (
            <li key={`${c.entity_id}-${c.field}-${i}`}>
              <span>{fieldLabel(c)}</span>
              <strong>{valueLabel(c)}</strong>
              <span className="muted">
                {sourceLabel(c.source)} · {c.changed_by} · {when(c.changed_at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
