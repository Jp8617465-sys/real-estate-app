import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { kindLabel } from "./ProfessionalsPage";

type Linked = components["schemas"]["EngagementProfessionals"];
type Pro = components["schemas"]["ProSummary"];

export function ProfessionalsPanel({ engagementId }: { engagementId: string }) {
  const [linked, setLinked] = useState<Linked | null>(null);
  const [directory, setDirectory] = useState<Pro[]>([]);
  const [pick, setPick] = useState({ person: "", role: "" });
  const path = { params: { path: { engagement_id: engagementId } } };

  const load = useCallback(() => {
    api.GET("/api/engagements/{engagement_id}/professionals", path).then(({ data }) => data && setLinked(data));
    api.GET("/api/professionals", { params: { query: {} } }).then(({ data }) => data && setDirectory(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementId]);
  useEffect(load, [load]);

  if (!linked) return null;
  return (
    <section className="panel">
      <h2>Professionals on this engagement</h2>
      <ul className="plain">
        {linked.current.map((p) => (
          <li key={p.person_id}>
            <Link to={`/people/${p.person_id}`}>{p.name}</Link> <span className="pill">{p.role}</span>{" "}
            <span className="muted">{[kindLabel(p.kind), p.firm].filter(Boolean).join(" · ")}</span>{" "}
            <button className="linkbtn" onClick={() => api.POST("/api/engagements/{engagement_id}/professionals/{person_id}/end", { params: { path: { engagement_id: engagementId, person_id: p.person_id } } }).then(load)}>
              remove
            </button>
          </li>
        ))}
        {linked.current.length === 0 && <li className="muted">None yet.</li>}
      </ul>
      {linked.former.length > 0 && <p className="muted">Former: {linked.former.map((p) => p.name).join(", ")}</p>}
      <div className="edit">
        <select value={pick.person} onChange={(e) => setPick({ ...pick, person: e.target.value })} aria-label="Professional">
          <option value="">Choose a professional…</option>
          {directory.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({kindLabel(p.kind)})</option>
          ))}
        </select>
        <input value={pick.role} onChange={(e) => setPick({ ...pick, role: e.target.value })} placeholder="Role here, e.g. their mortgage broker" aria-label="Role" />
        <button className="button" disabled={!pick.person || !pick.role.trim()} onClick={() => api.POST("/api/engagements/{engagement_id}/professionals", { ...path, body: { person_id: pick.person, role: pick.role.trim() } }).then(() => { setPick({ person: "", role: "" }); load(); })}>
          Add
        </button>
      </div>
      <p className="muted small"><Link to="/professionals">Manage the directory</Link></p>
    </section>
  );
}
