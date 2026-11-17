import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { money } from "../format";

type Board = components["schemas"]["Board"];

export function PipelinePage() {
  const [board, setBoard] = useState<Board | null>(null);
  useEffect(() => {
    api.GET("/api/v1/pipeline").then(({ data }) => data && setBoard(data));
  }, []);
  if (!board) return null;
  const shown = board.columns.filter((c) => c.group !== "closed" || c.engagements.length > 0);
  return (
    <>
      <div className="eyebrow">Pipeline</div>
      <h1>Every engagement, by stage</h1>
      <p className="muted">Stages are provisional until the pilot agency confirms them.</p>
      <div className="board">
        {shown.map((c) => (
          <section className="column" key={c.stage}>
            <h2>
              {c.label} <span className="pill">{c.engagements.length}</span>
            </h2>
            {c.engagements.map((e) => (
              <Link className="card-link" key={e.id} to={`/engagements/${e.id}`}>
                <strong>{e.household_name}</strong>
                <span className="muted">{e.client_names.join(", ")}</span>
                <span className="muted">
                  {money(e.budget_aud)} · {e.days_in_stage === 0 ? "today" : `${e.days_in_stage}d here`}
                </span>
              </Link>
            ))}
            {c.engagements.length === 0 && <p className="muted small">None</p>}
          </section>
        ))}
      </div>
    </>
  );
}
