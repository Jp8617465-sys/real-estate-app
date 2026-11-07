import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { money, stageLabel, when } from "../format";

type Engagement = components["schemas"]["Engagement"];
type Change = components["schemas"]["ChangeLogEntry"];

const sourceLabel = (source: Change["source"]): string =>
  source["kind"] === "entered_by_hand" ? "Entered by hand" : String(source["kind"]);

const valueLabel = (c: Change): string =>
  c.field.endsWith("_aud") ? money(Number(c.new_value)) : String(c.new_value);

const fieldLabel = (c: Change): string =>
  `${c.entity.charAt(0).toUpperCase()}${c.entity.slice(1)} ${c.field.replace(/_aud$/, "").replace(/_/g, " ")}`;

export function EngagementPage() {
  const { id = "" } = useParams();
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [changes, setChanges] = useState<Change[]>([]);
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
