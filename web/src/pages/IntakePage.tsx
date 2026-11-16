import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { components } from "../api/schema";

type Intake = components["schemas"]["IntakeView"];
type Item = components["schemas"]["QueueItem"];
type Quote = components["schemas"]["QuoteView"];
type Speaker = components["schemas"]["SpeakerView"];
type Entry = components["schemas"]["RecordEntry"];
type Client = components["schemas"]["Client"];

type Selected = { cue: number; text: string } | null;

const KIND_LABELS: Record<string, string> = {
  agent: "Me (the agent)",
  household: "A client in the household",
  professional: "A professional (broker, selling agent…)",
  other: "Someone else",
};

const message = (error: unknown): string => {
  const detail = (error as { detail?: unknown } | undefined)?.detail;
  return typeof detail === "string" ? detail : "That did not work.";
};

export function IntakePage() {
  const { id = "" } = useParams();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [missing, setMissing] = useState(false);

  const path = { params: { path: { intake_id: id } } };

  useEffect(() => {
    api.GET("/api/intakes/{intake_id}", path).then(({ data }) => {
      if (!data) return setMissing(true);
      setIntake(data);
      api
        .GET("/api/engagements/{engagement_id}", { params: { path: { engagement_id: data.engagement_id } } })
        .then((r) => r.data && setClients(r.data.clients));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const apply = useCallback((result: { data?: Intake; error?: unknown }) => {
    if (result.data) {
      setIntake(result.data);
      setRefusal(null);
    } else {
      setRefusal(message(result.error));
    }
  }, []);

  if (missing) return <p className="muted">That intake was not found.</p>;
  if (!intake) return null;

  const decide = (type: string, itemId?: string, value?: string) =>
    api
      .POST("/api/intakes/{intake_id}/decisions", { ...path, body: { type, id: itemId, value } })
      .then(apply);

  return (
    <>
      <div className="eyebrow">
        <Link to="/">Engagements</Link> / <Link to={`/engagements/${intake.engagement_id}`}>Engagement</Link> / Discovery call
      </div>
      <div className="heading">
        <h1>{intake.source.filename}</h1>
        <span className="pill">
          {{ speakers: "1 · Match speakers", review: "2 · Review", result: "3 · Result" }[intake.stage]}
        </span>
      </div>
      <p className="notice">{intake.notice}</p>
      <div className={refusal ? "message refused" : "message"} role="status">
        <b>{refusal ? "Refused" : "Just now"}</b> {refusal ?? intake.last.text}
      </div>
      <div className="work">
        <div className="steps-col">
          {intake.stage === "speakers" && (
            <Speakers intake={intake} clients={clients} path={path} apply={apply} />
          )}
          {intake.stage === "review" && (
            <Review intake={intake} path={path} apply={apply} decide={decide} onSelect={setSelected} />
          )}
          {intake.stage === "result" && <Result intake={intake} />}
        </div>
        <Transcript intake={intake} selected={selected} />
      </div>
    </>
  );
}

// ---- Step 1: match every speaker before any suggestion is shown -------------------------------

function Speakers(props: {
  intake: Intake;
  clients: Client[];
  path: { params: { path: { intake_id: string } } };
  apply: (r: { data?: Intake; error?: unknown }) => void;
}) {
  const { intake, path, apply } = props;
  const unmatched = intake.speakers.filter((s) => !s.match).length;
  return (
    <section>
      <h2>Who is speaking?</h2>
      <p className="muted">
        Match each speaker label to a person. Suggestions stay hidden until every speaker is matched, because every
        later rule depends on whose words are whose.
      </p>
      {intake.extraction_note && <p className="warnbox">{intake.extraction_note}</p>}
      {intake.dropped_count > 0 && (
        <details className="panel">
          <summary>
            {intake.dropped_count} suggestion{intake.dropped_count === 1 ? "" : "s"} dropped before review
          </summary>
          <ul className="plain">
            {intake.dropped.map((d) => (
              <li key={d.id}>
                <strong>{d.field}</strong>: {d.value}
                <div className="muted">{d.reason}</div>
              </li>
            ))}
          </ul>
        </details>
      )}
      {intake.speakers.map((s) => (
        <SpeakerCard key={s.label} speaker={s} clients={props.clients} intakeId={intake.id} apply={apply} path={path} />
      ))}
      <div className="foot">
        <span className="muted">{unmatched ? `${unmatched} speaker${unmatched === 1 ? "" : "s"} not matched yet` : "Every speaker is matched."}</span>
        <button
          className="button primary"
          onClick={() => api.POST("/api/intakes/{intake_id}/speakers/confirm", path).then(apply)}
        >
          Confirm speakers and show suggestions
        </button>
      </div>
    </section>
  );
}

function SpeakerCard(props: {
  speaker: Speaker;
  clients: Client[];
  intakeId: string;
  path: { params: { path: { intake_id: string } } };
  apply: (r: { data?: Intake; error?: unknown }) => void;
}) {
  const { speaker, clients, path, apply } = props;
  const m = speaker.match;
  const [kind, setKind] = useState(m?.kind ?? "");
  const [name, setName] = useState(m?.name ?? "");
  const [role, setRole] = useState(m?.role ?? "");

  const save = (next: { kind?: string; name?: string; role?: string; person_id?: string | null; is_new?: boolean }) => {
    const k = next.kind ?? kind;
    if (!k) {
      return api
        .PUT("/api/intakes/{intake_id}/speakers", { ...path, body: { label: speaker.label, kind: null, name: "", role: "", is_new: false } })
        .then(apply);
    }
    return api
      .PUT("/api/intakes/{intake_id}/speakers", {
        ...path,
        body: {
          label: speaker.label,
          kind: k,
          name: next.name ?? name,
          role: next.role ?? role,
          person_id: next.person_id ?? null,
          is_new: next.is_new ?? (k === "household" && !next.person_id),
        },
      })
      .then(apply);
  };

  return (
    <div className={`card speaker${speaker.warning ? " blocked" : ""}`}>
      <div className="fieldname">
        {speaker.turn_count} turns{m?.guessed ? " · guessed from the label, please confirm" : ""}
      </div>
      <div className="value">{speaker.label}</div>
      <div className="two">
        <label>
          This is
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              void save({ kind: e.target.value });
            }}
          >
            <option value="">Choose…</option>
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {kind === "household" && clients.length > 0 && (
          <label>
            Existing client
            <select
              value={m?.person_id ?? ""}
              onChange={(e) => {
                const c = clients.find((x) => x.id === e.target.value);
                if (c) {
                  setName(c.name);
                  void save({ kind: "household", name: c.name, person_id: c.id, is_new: false });
                } else void save({ kind: "household", is_new: true });
              }}
            >
              <option value="">A new household member</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {kind && (
        <div className="two">
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void save({ name })}
              placeholder={kind === "agent" ? "Your name" : "Their name"}
            />
          </label>
          {(kind === "professional" || kind === "other") && (
            <label>
              Role
              <input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                onBlur={() => void save({ role })}
                placeholder="e.g. Mortgage broker"
              />
            </label>
          )}
        </div>
      )}
      {kind && <p className="hint">{speaker.unlocks[kind]}</p>}
      {speaker.warning && <p className="warnbox">{speaker.warning}</p>}
    </div>
  );
}

// ---- Step 2: decisions first, then the ready list ------------------------------------------------

function Review(props: {
  intake: Intake;
  path: { params: { path: { intake_id: string } } };
  apply: (r: { data?: Intake; error?: unknown }) => void;
  decide: (type: string, id?: string, value?: string) => Promise<void>;
  onSelect: (s: Selected) => void;
}) {
  const { intake, path, apply, decide, onSelect } = props;
  const needs = intake.queue.filter((i) => i.bucket === "decide");
  const ready = intake.queue.filter((i) => i.bucket === "ready");
  const done = intake.queue.filter((i) => i.bucket === "done");
  const [editing, setEditing] = useState<string | null>(null);

  const quoteButtons = (quotes: Quote[]) =>
    quotes.map((q) => (
      <button className="q" key={`${q.cue}-${q.text}`} onClick={() => onSelect({ cue: q.cue, text: q.text })}>
        “{q.text}”<span className="by">{q.speaker_name} · {q.time}</span>
      </button>
    ));

  const grouped = (items: Item[], render: (i: Item) => ReactElement) =>
    intake.sections.map(({ key, label }) => {
      const here = items.filter((i) => i.section === key);
      return here.length ? (
        <div key={key}>
          <div className="group">{label}</div>
          {here.map(render)}
        </div>
      ) : null;
    });

  const actions = (i: Item, compact: boolean) => (
    <div className="acts">
      {!i.blocked && i.conflict?.type === "superseded" && (
        <button onClick={() => void decide("useEarlier", i.id)}>Use the earlier value</button>
      )}
      {!i.blocked && (
        <button className="primary" onClick={() => void decide("accept", i.id)}>
          {i.conflict?.type === "disagreement" ? "Keep as unresolved, to discuss" : i.current ? "Replace the value on record" : "Accept"}
        </button>
      )}
      {!i.blocked && <button onClick={() => setEditing(editing === i.id ? null : i.id)}>Edit</button>}
      {i.blocked && <button onClick={() => void decide("ask", i.id)}>Ask the client</button>}
      {!compact && !i.blocked && <button onClick={() => void decide("ask", i.id)}>Ask the client</button>}
      <button className="danger" onClick={() => void decide("reject", i.id)}>
        Reject
      </button>
    </div>
  );

  const editor = (i: Item) =>
    editing === i.id ? (
      <EditValue
        initial={i.value}
        onSave={(v) => {
          setEditing(null);
          void decide("edit", i.id, v);
        }}
      />
    ) : null;

  return (
    <section>
      <h2>Review the call</h2>
      <p className="muted">
        {intake.dropped_count} dropped before review (see Speakers). Nothing is written to the record until you finish, and then only what you accepted.
      </p>
      {needs.length > 0 && (
        <>
          <div className="section-title">
            <h2>Needs your decision ({needs.length})</h2>
          </div>
          {grouped(needs, (i) => (
            <div key={i.id} className={`card${i.blocked ? " blocked" : ""}`}>
              <div className="fieldname">
                {i.item}
                {i.subject ? ` · ${i.subject}` : ""} · {i.basis}
              </div>
              <div className="value">{i.value}</div>
              {i.owner_names && <div className="who-owes">{i.owner_names.join(" and ")} · due {i.due}</div>}
              <div className="pills">
                {i.reasons.map((r) => (
                  <span key={r.code} className={`pill ${r.tone}`}>
                    {r.text}
                  </span>
                ))}
              </div>
              {quoteButtons(i.quotes)}
              {i.current && (
                <div className="aside">
                  <b>On record</b>
                  {i.current.value} <span className="muted">({i.current.source})</span>
                </div>
              )}
              {i.conflict?.earlier && (
                <div className="aside">
                  <b>Earlier in the call</b>
                  {i.conflict.earlier.value}
                  {quoteButtons(i.conflict.earlier.quotes)}
                </div>
              )}
              {i.conflict?.views && (
                <div className="aside">
                  <b>They disagree</b>
                  {i.conflict.views.map((v) => (
                    <div key={v.person}>
                      {v.person}: {v.value}
                      {quoteButtons([v.quote])}
                    </div>
                  ))}
                </div>
              )}
              {i.blocked && (
                <div className="aside bad">
                  <b>Can't be applied</b>
                  {i.blocked}
                </div>
              )}
              {actions(i, false)}
              {editor(i)}
            </div>
          ))}
        </>
      )}
      {ready.length > 0 && (
        <>
          <div className="section-title">
            <h2>Ready to accept ({ready.length})</h2>
          </div>
          <div className="bulk">
            <p>
              Stated, unconflicted, and said by the right person. Each row shows its value beside its quote and has its
              own reject. Items above are not touched.
            </p>
            <button className="button primary" onClick={() => api.POST("/api/intakes/{intake_id}/accept-rest", path).then(apply)}>
              Accept all {ready.length} ready rows
            </button>
          </div>
          <div className="ready">
            {grouped(ready, (i) => (
              <div key={i.id} className="rowitem">
                <div>
                  <div className="fieldname">
                    {i.item}
                    {i.subject ? ` · ${i.subject}` : ""} · {i.basis}
                  </div>
                  <div className="value small">{i.value}</div>
                  {quoteButtons(i.quotes)}
                  {editor(i)}
                </div>
                <div className="acts">
                  <button onClick={() => setEditing(editing === i.id ? null : i.id)}>Edit</button>
                  <button className="danger" onClick={() => void decide("reject", i.id)}>
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {done.length > 0 && (
        <details className="decided" open={needs.length + ready.length === 0}>
          <summary>Decided ({done.length})</summary>
          {done.map((i) => (
            <div key={i.id} className="drow">
              <span className="pill">{i.decision?.status}</span>
              <span>
                {i.item}: {i.decision?.value ?? i.value}
              </span>
              <button className="button" onClick={() => void decide("undo", i.id)}>
                Undo
              </button>
            </div>
          ))}
        </details>
      )}
      <div className="foot">
        <button className="button" onClick={() => api.POST("/api/intakes/{intake_id}/speakers/edit", path).then(apply)}>
          Back to speakers
        </button>
        <button className="button primary" onClick={() => api.POST("/api/intakes/{intake_id}/finish", path).then(apply)}>
          Finish the review
        </button>
      </div>
    </section>
  );
}

function EditValue(props: { initial: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(props.initial);
  return (
    <div className="edit">
      <input value={v} onChange={(e) => setV(e.target.value)} aria-label="Edited value" />
      <button className="button primary" onClick={() => props.onSave(v)}>
        Apply edited value
      </button>
      <span className="hint">The quote stays with it as its source.</span>
    </div>
  );
}

// ---- Step 3: what the call recorded and what it did not --------------------------------------------

function Result({ intake }: { intake: Intake }) {
  const s = intake.summary;
  if (!s) return null;
  const entries = (list: Entry[]) =>
    list.map((e, i) => (
      <div className="kv" key={`${e.field}-${i}`}>
        <div className="k">
          {e.label}
          {e.subject ? ` · ${e.subject}` : ""}
        </div>
        <div>{e.value}</div>
        {e.owners && (
          <div className="who-owes">
            {e.owners.join(" and ")} · due {e.due}
          </div>
        )}
        <div className="src">{e.source}</div>
        {e.history.map((h) => (
          <div className="was" key={h.value}>
            Earlier: {h.value} ({h.source})
          </div>
        ))}
      </div>
    ));
  return (
    <section>
      <h2>Review finished</h2>
      <div className="stats">
        <div className="stat">
          <b>{s.written}</b>
          <span>values written</span>
        </div>
        <div className="stat">
          <b>{s.undecided.length}</b>
          <span>left undecided (nothing written)</span>
        </div>
        <div className="stat">
          <b>{intake.review_seconds ?? 0}s</b>
          <span>review time</span>
        </div>
      </div>
      {intake.sections.map(({ key, label }) =>
        s.entries[key]?.length ? (
          <div className="panel" key={key}>
            <h2>{label}</h2>
            {entries(s.entries[key])}
          </div>
        ) : null,
      )}
      {s.to_discuss.length > 0 && (
        <div className="panel">
          <h2>Unresolved, to discuss</h2>
          {entries(s.to_discuss)}
        </div>
      )}
      <div className="panel">
        <h2>Not covered on this call</h2>
        <ul className="gaps">
          {s.not_covered.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>
      {s.ask.length > 0 && (
        <div className="panel">
          <h2>Ask the client</h2>
          <ul className="gaps">
            {s.ask.map((i) => (
              <li key={i.id}>
                {i.item}: {i.value}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="foot">
        <Link className="button primary" to={`/engagements/${intake.engagement_id}`}>
          See the engagement record
        </Link>
      </div>
    </section>
  );
}

// ---- The transcript, with the selected quote highlighted ------------------------------------------------

function Transcript({ intake, selected }: { intake: Intake; selected: Selected }) {
  const turns = useMemo(() => intake.turns, [intake.turns]);
  useEffect(() => {
    if (selected) document.getElementById(`cue-${selected.cue}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);
  return (
    <aside className="side" aria-label="Transcript">
      <div className="side-body">
        {turns.map((t) => {
          const hit = selected && selected.cue === t.n;
          const at = hit ? t.text.indexOf(selected.text) : -1;
          return (
            <div key={t.n} id={`cue-${t.n}`} className={`cue${hit ? " hit focus" : ""}`}>
              <span className="t">{t.time}</span>
              <div>
                <div className="who">{t.speaker}</div>
                {at >= 0 && selected ? (
                  <>
                    {t.text.slice(0, at)}
                    <mark>{selected.text}</mark>
                    {t.text.slice(at + selected.text.length)}
                  </>
                ) : (
                  t.text
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
