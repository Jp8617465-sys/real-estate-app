import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { money, stageLabel } from "../format";

type Summary = components["schemas"]["EngagementSummary"];

export function EngagementList() {
  const [engagements, setEngagements] = useState<Summary[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.GET("/api/engagements").then(({ data }) => {
      if (data) setEngagements(data);
      else setFailed(true);
    });
  }, []);

  return (
    <>
      <div className="eyebrow">Engagements</div>
      <div className="heading">
        <h1>Buying opportunities</h1>
        <Link className="button primary" to="/new">
          New opportunity
        </Link>
      </div>
      {failed && <p className="error">The engagements could not be loaded.</p>}
      {engagements?.length === 0 && (
        <section className="panel">
          <h2>No opportunities yet</h2>
          <p className="muted">Create one for a household you are speaking with.</p>
        </section>
      )}
      <ul className="rows">
        {engagements?.map((e) => (
          <li key={e.id}>
            <Link to={`/engagements/${e.id}`} className="row">
              <span className="row-main">
                <strong>{e.household_name}</strong>
                <span className="muted">{e.client_names.join(", ")}</span>
              </span>
              <span className="pill">{stageLabel(e.stage)}</span>
              <span className="muted">{money(e.budget_aud)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
