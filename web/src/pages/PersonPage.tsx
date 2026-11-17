import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { stageLabel } from "../format";
import { duplicateOf } from "./PeoplePage";

type Detail = components["schemas"]["PersonDetail"];
type Summary = components["schemas"]["PersonSummary"];
type Household = components["schemas"]["HouseholdView"];
type Check = components["schemas"]["IdentityCheckView"];

const KINDS = ["partner", "parent", "child", "sibling", "other"] as const;

export function PersonPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState<Detail | null>(null);
  const [households, setHouseholds] = useState<Record<string, Household>>({});
  const [everyone, setEveryone] = useState<Summary[]>([]);
  const [edit, setEdit] = useState({ name: "", email: "", mobile: "" });
  const [message, setMessage] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<ReturnType<typeof duplicateOf>>(null);
  const [rel, setRel] = useState<{ other: string; kind: (typeof KINDS)[number] }>({ other: "", kind: "partner" });
  const [missing, setMissing] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.GET("/api/v1/people/{person_id}", { params: { path: { person_id: id } } });
    if (!data) return setMissing(true);
    setPerson(data);
    setEdit({ name: data.name, email: data.email ?? "", mobile: data.mobile ?? "" });
    const loaded: Record<string, Household> = {};
    for (const h of data.households) {
      const r = await api.GET("/api/v1/households/{household_id}", { params: { path: { household_id: h.household_id } } });
      if (r.data) loaded[h.household_id] = r.data;
    }
    setHouseholds(loaded);
    const c = await api.GET("/api/v1/people/{person_id}/identity-checks", { params: { path: { person_id: id } } });
    if (c.data) setChecks(c.data);
    const all = await api.GET("/api/v1/people", { params: { query: { limit: 200 } } });
    if (all.data) setEveryone(all.data.filter((p) => p.id !== id));
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (missing) return <p className="muted">That client was not found.</p>;
  if (!person) return null;

  const save = async (confirm: boolean) => {
    setMessage(null);
    const { error } = await api.PATCH("/api/v1/people/{person_id}", {
      params: { path: { person_id: id } },
      body: { name: edit.name, email: edit.email || null, mobile: edit.mobile || null, confirm_duplicate: confirm },
    });
    const dup = duplicateOf(error);
    if (dup) return setDuplicate(dup);
    setDuplicate(null);
    setMessage(error ? "That could not be saved." : "Saved. The change is in the history.");
    await load();
  };

  const newHousehold = async () => {
    const surname = person.name.split(" ").slice(-1)[0];
    await api.POST("/api/v1/households", { body: { name: `${surname} household`, member_ids: [id] } });
    await load();
  };

  const openOpportunity = async (householdId: string) => {
    const { data, error } = await api.POST("/api/v1/households/{household_id}/opportunities", {
      params: { path: { household_id: householdId } },
      body: {},
    });
    if (data) navigate(`/engagements/${data.id}`);
    else setMessage(String((error as { detail?: unknown } | undefined)?.detail ?? "Could not open an opportunity."));
  };

  const addRelationship = async () => {
    const { error } = await api.POST("/api/v1/people/{person_id}/relationships", {
      params: { path: { person_id: id } },
      body: { other_person_id: rel.other, kind: rel.kind },
    });
    setMessage(error ? String((error as { detail?: unknown }).detail ?? "Could not add that.") : null);
    if (!error) setRel({ ...rel, other: "" });
    await load();
  };

  const addMember = async (householdId: string, personId: string) => {
    await api.POST("/api/v1/households/{household_id}/members", {
      params: { path: { household_id: householdId } },
      body: { person_id: personId },
    });
    await load();
  };

  const endMember = async (householdId: string, personId: string) => {
    await api.POST("/api/v1/households/{household_id}/members/{person_id}/end", {
      params: { path: { household_id: householdId, person_id: personId } },
      body: {},
    });
    await load();
  };

  return (
    <>
      <div className="eyebrow">
        <Link to="/people">Clients</Link> / {person.name}
      </div>
      <h1>{person.name}</h1>
      {message && (
        <div className="message" role="status">
          {message}
        </div>
      )}
      <section className="panel form">
        <h2>Details</h2>
        <label>
          Name
          <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
        </label>
        <div className="two">
          <label>
            Email
            <input value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
          </label>
          <label>
            Mobile
            <input value={edit.mobile} onChange={(e) => setEdit({ ...edit, mobile: e.target.value })} />
          </label>
        </div>
        {duplicate && (
          <div className="warnbox" role="alert">
            {duplicate.message}
            <ul className="plain">
              {duplicate.matches.map((m) => (
                <li key={m.id}>
                  <Link to={`/people/${m.id}`}>{m.name}</Link>
                </li>
              ))}
            </ul>
            <button className="button" onClick={() => void save(true)}>
              Save anyway
            </button>
          </div>
        )}
        <div>
          <button className="button primary" onClick={() => void save(false)}>
            Save changes
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Households</h2>
        {person.households.length === 0 && <p className="muted">Not in a household yet.</p>}
        {person.households.map((h) => {
          const view = households[h.household_id];
          const current = h.ended_on === null;
          return (
            <div className="card" key={h.household_id}>
              <div className="fieldname">
                {current ? `Since ${h.started_on}` : `Left ${h.ended_on}`}
              </div>
              <div className="value">{h.name}</div>
              {view && (
                <p className="muted">
                  Members: {view.members.map((m) => m.name).join(", ") || "none now"}
                  {view.former_members.length > 0 && ` · former: ${view.former_members.map((m) => m.name).join(", ")}`}
                </p>
              )}
              {view && view.engagements.length > 0 && (
                <p>
                  {view.engagements.map((e) => (
                    <Link key={e.id} to={`/engagements/${e.id}`}>
                      {stageLabel(e.stage)} engagement{" "}
                    </Link>
                  ))}
                </p>
              )}
              {current && (
                <div className="acts">
                  <button className="primary" onClick={() => void openOpportunity(h.household_id)}>
                    Open a buying opportunity
                  </button>
                  <select defaultValue="" onChange={(e) => e.target.value && void addMember(h.household_id, e.target.value)} aria-label="Add a member">
                    <option value="">Add a member…</option>
                    {everyone.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button onClick={() => void endMember(h.household_id, id)}>{person.name.split(" ")[0]} has left</button>
                </div>
              )}
            </div>
          );
        })}
        <button className="button" onClick={() => void newHousehold()}>
          Start a new household
        </button>
      </section>

      <section className="panel">
        <h2>Relationships</h2>
        <ul className="plain">
          {person.relationships.map((r) => (
            <li key={r.id}>
              <Link to={`/people/${r.other_person_id}`}>{r.other_name}</Link> <span className="pill">{r.kind}</span>
            </li>
          ))}
          {person.relationships.length === 0 && <li className="muted">None recorded.</li>}
        </ul>
        <div className="acts">
          <select value={rel.other} onChange={(e) => setRel({ ...rel, other: e.target.value })} aria-label="Related person">
            <option value="">Choose a person…</option>
            {everyone.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select value={rel.kind} onChange={(e) => setRel({ ...rel, kind: e.target.value as (typeof KINDS)[number] })} aria-label="Relationship">
            {KINDS.map((k) => (
              <option key={k} value={k}>
                is their {k}
              </option>
            ))}
          </select>
          <button disabled={!rel.other} onClick={() => void addRelationship()}>
            Add
          </button>
        </div>
      </section>

      <section className="panel">
        <h2>Identity checks</h2>
        <p className="warnbox">Synthetic only: shows the shape of a check. No identity provider is connected, and the AML/CTF requirements are not decided yet. This is not a real check.</p>
        <ul className="plain">
          {checks.map((c) => (
            <li key={c.id}>
              <span className={`pill ${c.status === "failed" ? "bad" : c.status === "needs_review" ? "warn" : ""}`}>{c.status.replace("_", " ")}</span> {c.kind.replace("_", " ")} · {c.reference}
              <div className="muted small">{c.evidence.join(" ")} ({c.provider})</div>
            </li>
          ))}
          {checks.length === 0 && <li className="muted">No checks run.</li>}
        </ul>
        {(["customer_identification", "sanctions_pep"] as const).map((k) => (
          <button key={k} className="button" onClick={() => api.POST("/api/v1/people/{person_id}/identity-checks", { params: { path: { person_id: id } }, body: { kind: k } }).then(load)}>
            Run {k.replace("_", " ")} check
          </button>
        ))}
      </section>

      {person.engagements.length > 0 && (
        <section className="panel">
          <h2>Engagements</h2>
          <ul className="plain">
            {person.engagements.map((e) => (
              <li key={e.id}>
                <Link to={`/engagements/${e.id}`}>{e.household_name}</Link> <span className="pill">{stageLabel(e.stage)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
