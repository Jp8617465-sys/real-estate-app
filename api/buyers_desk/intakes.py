"""The discovery-call intake API: upload, speaker matching, review, finish, and the record it builds.

Review decisions are saved on the intake as they are made, so they survive a restart. Nothing is
written to the engagement's record until the review is finished, and then only what was accepted.
"""
import json
import re
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import Connection, text

from buyers_desk.engagements import LOCAL_AGENT, Conn, _read
from buyers_desk.intake import review, transcript
from buyers_desk.intake.extraction import ExtractionRequest, ScriptedExtractor
from buyers_desk.intake.fields import FIELDS, SECTIONS
from buyers_desk.professionals import infer_kind
from buyers_desk.schemas import (
    Decision,
    EngagementRecord,
    IntakeSummary,
    IntakeView,
    NewIntake,
    ProfessionalView,
    Section,
    RecordValue,
    SpeakerMatchRequest,
)

router = APIRouter(prefix="/api", tags=["intake"])

NOTICE = (
    "Only synthetic or role-play material may be used here. Extraction runs on the global Claude "
    "API, outside Australia, so never upload a real client's conversation."
)

_SECTIONS = [Section(key=k, label=label) for k, label in SECTIONS]
_REVIEW_ORDER = {"decide": 0, "ready": 1, "done": 2}


# ---- Create, list, read -----------------------------------------------------------------------------


@router.post("/engagements/{engagement_id}/intakes", status_code=201, response_model=IntakeView)
def create_intake(engagement_id: UUID, body: NewIntake, request: Request, conn: Conn) -> IntakeView:
    engagement = _read(conn, engagement_id)  # 404 if there is no such engagement
    kind, turns = transcript.parse(body.filename, body.text, notes=body.notes)
    if not turns:
        raise HTTPException(status_code=422, detail="No speaker turns or notes were found in that file")
    clients = [c.model_dump() for c in engagement.clients]
    existing = _existing(conn, engagement_id)
    extractor = request.app.state.extractor
    raw = extractor.extract(ExtractionRequest(turns=turns, fields=list(FIELDS.values()), existing=existing))
    kept, dropped = review.check_suggestions(turns, raw)
    labels = list(dict.fromkeys(t["speaker"] for t in turns))
    state = review.initial_state(
        turns=turns,
        suggestions=kept,
        dropped=dropped,
        people=[c["name"] for c in clients],
        existing=existing,
        guesses=review.guess_speakers(labels, clients, notes=kind == "notes"),
        source_kind=kind,
    )
    if isinstance(extractor, ScriptedExtractor) and not extractor.knows(turns):
        state["extraction_note"] = (
            "The scripted extractor has no recorded suggestions for this transcript, so there is "
            "nothing to review. Select the Claude extractor to extract from any transcript."
        )
    intake_id = conn.execute(
        text(
            "INSERT INTO intakes (agency_id, engagement_id, filename, source_kind, extractor, turns, state) "
            "VALUES (:agency, :engagement, :filename, :kind, :extractor, CAST(:turns AS jsonb), "
            "CAST(:state AS jsonb)) RETURNING id"
        ),
        {
            "agency": request.app.state.settings.agency_id,
            "engagement": engagement_id,
            "filename": body.filename,
            "kind": kind,
            "extractor": extractor.name,
            "turns": json.dumps(turns),
            "state": json.dumps(state),
        },
    ).scalar_one()
    return _view(conn, intake_id)


@router.get("/engagements/{engagement_id}/intakes", response_model=list[IntakeSummary])
def list_intakes(engagement_id: UUID, conn: Conn) -> list[IntakeSummary]:
    _read(conn, engagement_id)
    rows = conn.execute(
        text(
            "SELECT id, filename, state->>'stage' AS stage, created_at FROM intakes "
            "WHERE engagement_id = :id ORDER BY created_at DESC, id"
        ),
        {"id": engagement_id},
    ).mappings()
    return [IntakeSummary(**r) for r in rows]


@router.get("/intakes/{intake_id}", response_model=IntakeView)
def get_intake(intake_id: UUID, conn: Conn) -> IntakeView:
    return _view(conn, intake_id)


# ---- Speakers and decisions -----------------------------------------------------------------------------


@router.put("/intakes/{intake_id}/speakers", response_model=IntakeView)
def match_speaker(intake_id: UUID, body: SpeakerMatchRequest, request: Request, conn: Conn) -> IntakeView:
    return _act(conn, request, intake_id, {"type": "matchSpeaker", **body.model_dump()})


@router.post("/intakes/{intake_id}/speakers/confirm", response_model=IntakeView)
def confirm_speakers(intake_id: UUID, request: Request, conn: Conn) -> IntakeView:
    return _act(conn, request, intake_id, {"type": "confirmSpeakers"})


@router.post("/intakes/{intake_id}/speakers/edit", response_model=IntakeView)
def edit_speakers(intake_id: UUID, request: Request, conn: Conn) -> IntakeView:
    return _act(conn, request, intake_id, {"type": "editSpeakers"})


@router.post("/intakes/{intake_id}/decisions", response_model=IntakeView)
def decide(intake_id: UUID, body: Decision, request: Request, conn: Conn) -> IntakeView:
    if body.type not in ("accept", "edit", "reject", "ask", "useEarlier", "undo"):
        raise HTTPException(status_code=422, detail=f"Unknown decision {body.type}")
    return _act(conn, request, intake_id, body.model_dump())


@router.post("/intakes/{intake_id}/accept-rest", response_model=IntakeView)
def accept_rest(intake_id: UUID, request: Request, conn: Conn) -> IntakeView:
    return _act(conn, request, intake_id, {"type": "acceptRest"})


@router.post("/intakes/{intake_id}/finish", response_model=IntakeView)
def finish(intake_id: UUID, request: Request, conn: Conn) -> IntakeView:
    return _act(conn, request, intake_id, {"type": "finish"})


# ---- The record the intakes build --------------------------------------------------------------------------


@router.get("/engagements/{engagement_id}/record", response_model=EngagementRecord)
def get_record(engagement_id: UUID, conn: Conn) -> EngagementRecord:
    _read(conn, engagement_id)
    rows = conn.execute(
        text(
            "SELECT field, subject, value, status, basis, source, quotes, section, created_at, current, extra "
            "FROM record_values WHERE engagement_id = :id ORDER BY created_at, id"
        ),
        {"id": engagement_id},
    ).mappings().all()
    values: list[RecordValue] = []
    for r in rows:
        if not r["current"]:
            continue
        earlier = r["extra"].get("history", [])
        values.append(
            RecordValue.model_validate(dict(
                field=r["field"], label=FIELDS[r["field"]].item, section=r["section"], subject=r["subject"],
                value=r["value"], status=r["status"], basis=r["basis"], source=r["source"]["label"],
                quotes=r["quotes"], earlier=earlier, recorded_at=r["created_at"],
            ))
        )
    professionals = conn.execute(
        text(
            "SELECT p.id AS person_id, p.name, ep.role FROM engagement_professionals ep "
            "JOIN persons p ON p.id = ep.person_id WHERE ep.engagement_id = :id ORDER BY p.name"
        ),
        {"id": engagement_id},
    ).mappings()
    return EngagementRecord(
        engagement_id=engagement_id,
        sections=_SECTIONS,
        values=values,
        professionals=[ProfessionalView(**p) for p in professionals],
    )


# ---- Internals -------------------------------------------------------------------------------------------------


def _existing(conn: Connection, engagement_id: UUID) -> dict[str, dict[str, Any]]:
    """The values already on record, keyed as the review keys them."""
    existing: dict[str, dict[str, Any]] = {}
    budget = conn.execute(
        text("SELECT budget_aud FROM buyer_briefs WHERE engagement_id = :id"), {"id": engagement_id}
    ).scalar()
    if budget:
        existing["budgetTarget"] = {"value": _money(budget), "source": "Entered by hand"}
    rows = conn.execute(
        text(
            "SELECT field, subject, value, source FROM record_values "
            "WHERE engagement_id = :id AND current ORDER BY created_at, id"
        ),
        {"id": engagement_id},
    ).mappings()
    for r in rows:
        if FIELDS[r["field"]].kind == "one":
            existing[review.record_key(r["field"], r["subject"])] = {"value": r["value"], "source": r["source"]["label"]}
    return existing


def _money(amount: int) -> str:
    return f"${amount // 1000}k" if amount % 1000 == 0 else f"${amount:,}"


_AMOUNT = re.compile(r"\$\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m|million)?\b", re.I)


def _budget_from(value: str) -> int | None:
    m = _AMOUNT.search(value)
    if not m:
        return None
    n = float(m.group(1).replace(",", ""))
    unit = (m.group(2) or "").lower()
    n *= 1000 if unit == "k" else 1_000_000 if unit in ("m", "million") else 1
    return int(n) if n > 0 else None


def _load(conn: Connection, intake_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        text(
            "SELECT id, engagement_id, filename, source_kind, extractor, turns, state, review_started_at, "
            "review_seconds, created_at FROM intakes WHERE id = :id"
        ),
        {"id": intake_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such intake")
    return dict(row)


def _act(conn: Connection, request: Request, intake_id: UUID, action: dict[str, Any]) -> IntakeView:
    row = _load(conn, intake_id)
    try:
        state = review.reduce(row["state"], action)
    except review.Refused as refusal:
        raise HTTPException(status_code=409, detail=str(refusal)) from None
    columns: dict[str, Any] = {}
    if action["type"] == "confirmSpeakers" and row["review_started_at"] is None:
        columns["review_started_at"] = datetime.now(UTC)
    if action["type"] == "finish":
        started = row["review_started_at"] or datetime.now(UTC)
        columns["review_seconds"] = max(0, round((datetime.now(UTC) - started).total_seconds()))
        columns["applied_at"] = datetime.now(UTC)
        _apply(conn, request.app.state.settings.agency_id, row, state)
    sets = ", ".join(f"{k} = :{k}" for k in columns)
    conn.execute(
        text(f"UPDATE intakes SET state = CAST(:state AS jsonb){', ' + sets if sets else ''} WHERE id = :id"),
        {"state": json.dumps(state), "id": intake_id, **columns},
    )
    return _view(conn, intake_id)


def _quote_view(st: review.State, q: dict[str, Any]) -> dict[str, Any]:
    return {
        "speaker": q["speaker"], "speaker_name": review.name_of(st, q["speaker"]), "text": q["text"],
        "cue": q.get("cue", 0), "time": q.get("time", ""),
    }


def _item(st: review.State, x: dict[str, Any]) -> dict[str, Any]:
    s = x["s"]
    f = FIELDS[s["field"]]
    conflict = None
    c = s.get("conflict")
    if c:
        conflict = {"type": c["type"]}
        if c.get("earlier"):
            conflict["earlier"] = {
                "value": c["earlier"]["value"], "quotes": [_quote_view(st, q) for q in c["earlier"]["quotes"]],
            }
        if c.get("views"):
            conflict["views"] = [
                {"person": v["person"], "value": v["value"], "quote": _quote_view(st, v["quote"])}
                for v in c["views"]
            ]
    current = x["current"]
    return {
        "id": s["id"], "field": s["field"], "field_label": f.label, "item": f.item, "section": f.section,
        "group": f.group, "value": s["value"], "basis": s["basis"], "subject": s.get("subject"),
        "quotes": [_quote_view(st, q) for q in s["quotes"]], "conflict": conflict,
        "owners": s.get("owners"),
        "owner_names": [review.name_of(st, o) for o in s["owners"]] if s.get("owners") else None,
        "due": s.get("due"), "outcome": s.get("outcome"), "note": s.get("note"), "bucket": x["bucket"],
        "reasons": x["reasons"], "blocked": x["blocked"],
        "current": {"value": current["value"], "source": current.get("source")} if current else None,
        "decision": (
            {"status": x["decision"]["status"], "value": x["decision"].get("value")} if x["decision"] else None
        ),
    }


def _source_label(filename: str, st: review.State, quotes: list[dict[str, Any]], status: str) -> str:
    who = " and ".join(dict.fromkeys(review.name_of(st, q["speaker"]) for q in quotes))
    how = {"edited": "edited", "discuss": "kept to discuss", "earlier": "earlier value chosen"}.get(status, "accepted")
    return f"{filename} · {who} · {how} at review"


def _entry(st: review.State, filename: str, e: dict[str, Any]) -> dict[str, Any]:
    f = FIELDS[e["field"]]
    return {
        "field": e["field"], "label": f.item, "section": f.section, "subject": e.get("subject"),
        "value": e["value"], "status": e["status"], "basis": e.get("basis"),
        "quotes": [_quote_view(st, q) for q in e["quotes"]],
        "source": _source_label(filename, st, e["quotes"], e["status"]),
        "owners": [review.name_of(st, o) for o in e["owners"]] if e.get("owners") else None,
        "due": e.get("due"), "outcome": e.get("outcome"),
        "history": [{"value": h["value"], "source": h.get("source")} for h in e.get("history", [])],
    }


def _view(conn: Connection, intake_id: UUID) -> IntakeView:
    row = _load(conn, intake_id)
    st: review.State = row["state"]
    turns = row["turns"]
    in_review = st["stage"] in ("review", "result")
    speakers = []
    for label in st["labels"]:
        m = st["speakers"].get(label)
        warning = (
            review.PROFESSIONAL_WARNING
            if m and m["kind"] == "household" and review.sounds_like_a_professional(turns, label)
            else None
        )
        speakers.append({
            "label": label, "turn_count": sum(1 for t in turns if t["speaker"] == label), "match": m,
            "unlocks": review.unlocks(st["suggestions"], label), "warning": warning,
        })
    items = sorted(review.queue(st), key=lambda x: _REVIEW_ORDER[x["bucket"]]) if in_review else []
    summary = None
    if st["stage"] == "result":
        s = review.summary(st)
        by_id = {x["s"]["id"]: x for x in review.queue(st)}
        summary = {
            "entries": {k: [_entry(st, row["filename"], e["entry"]) for e in v] for k, v in s["entries"].items()},
            "to_discuss": [_entry(st, row["filename"], e["entry"]) for e in s["to_discuss"]],
            "not_covered": s["not_covered"],
            "ask": [_item(st, by_id[i]) for i in s["ask"]],
            "rejected": [_item(st, by_id[i]) for i in s["rejected"]],
            "undecided": [_item(st, by_id[i]) for i in s["undecided"]],
            "written": s["written"],
        }
    return IntakeView.model_validate(dict(
        id=row["id"], engagement_id=row["engagement_id"], stage=st["stage"],
        source={"filename": row["filename"], "kind": row["source_kind"]}, notice=NOTICE,
        extractor=row["extractor"], extraction_note=st.get("extraction_note"), turns=turns, speakers=speakers,
        dropped_count=len(st["dropped"]),
        dropped=[
            {"id": d["id"], "field": d.get("fieldLabel") or d["field"], "value": d["value"], "reason": d["reason"]}
            for d in st["dropped"]
        ],
        queue=[_item(st, x) for x in items], sections=_SECTIONS, summary=summary,
        review_seconds=row["review_seconds"], last=st["last"], created_at=row["created_at"],
    ))


# ---- Applying a finished review to the record ---------------------------------------------------------------------


def _log(
    conn: Connection, agency: UUID, entity: str, entity_id: UUID, field: str, new: Any, earlier: Any,
    source: dict[str, Any],
) -> None:
    conn.execute(
        text(
            "INSERT INTO change_log (agency_id, entity, entity_id, field, new_value, earlier_value, source, changed_by) "
            "VALUES (:agency, :entity, :entity_id, :field, CAST(:new AS jsonb), CAST(:earlier AS jsonb), "
            "CAST(:source AS jsonb), :by)"
        ),
        {
            "agency": agency, "entity": entity, "entity_id": entity_id, "field": field,
            "new": json.dumps(new), "earlier": json.dumps(earlier) if earlier is not None else None,
            "source": json.dumps(source), "by": LOCAL_AGENT,
        },
    )


def _apply(conn: Connection, agency: UUID, row: dict[str, Any], st: review.State) -> None:
    engagement_id = row["engagement_id"]
    filename = row["filename"]
    household_id = conn.execute(
        text("SELECT household_id FROM engagements WHERE id = :id"), {"id": engagement_id}
    ).scalar_one()
    now = datetime.now(UTC).isoformat()
    base = {"kind": "call_intake", "intake_id": str(row["id"]), "transcript": filename, "accepted_by": LOCAL_AGENT, "accepted_at": now}

    for label in st["labels"]:
        m = st["speakers"][label]
        if m["kind"] == "household" and m["is_new"] and not m["person_id"]:
            person = conn.execute(
                text("INSERT INTO persons (agency_id, name) VALUES (:a, :n) RETURNING id"), {"a": agency, "n": m["name"]}
            ).scalar_one()
            conn.execute(
                text("INSERT INTO household_members (agency_id, household_id, person_id) VALUES (:a, :h, :p)"),
                {"a": agency, "h": household_id, "p": person},
            )
            conn.execute(
                text("INSERT INTO engagement_clients (agency_id, engagement_id, person_id) VALUES (:a, :e, :p)"),
                {"a": agency, "e": engagement_id, "p": person},
            )
            _log(conn, agency, "client", person, "name", m["name"], None, {**base, "speaker": label})
        elif m["kind"] == "professional":
            person = m["person_id"] or conn.execute(
                text(
                    "SELECT p.id FROM persons p JOIN engagement_professionals ep ON ep.person_id = p.id "
                    "WHERE lower(p.name) = lower(:n) LIMIT 1"
                ),
                {"n": m["name"]},
            ).scalar()
            if person is None:
                person = conn.execute(
                    text("INSERT INTO persons (agency_id, name) VALUES (:a, :n) RETURNING id"), {"a": agency, "n": m["name"]}
                ).scalar_one()
                _log(conn, agency, "client", person, "name", m["name"], None, {**base, "speaker": label})
            conn.execute(
                text(
                    "INSERT INTO engagement_professionals (agency_id, engagement_id, person_id, role) "
                    "VALUES (:a, :e, :p, :r) ON CONFLICT DO NOTHING"
                ),
                {"a": agency, "e": engagement_id, "p": person, "r": m["role"] or "Professional"},
            )
            conn.execute(
                text("INSERT INTO professionals (person_id, agency_id, kind) VALUES (:p, :a, :k) ON CONFLICT DO NOTHING"),
                {"p": person, "a": agency, "k": infer_kind(m["role"] or "")},
            )

    by_id = {s["id"]: s for s in st["suggestions"]}
    for sid, d in sorted(st["decisions"].items(), key=lambda kv: kv[1]["seq"]):
        if d["status"] not in review.WRITTEN:
            continue
        s = by_id[sid]
        f = FIELDS[s["field"]]
        quotes = [_quote_view(st, q) for q in d["quotes"]]
        label = _source_label(filename, st, d["quotes"], d["status"])
        source = {
            **base, "label": label, "decision": d["status"], "edited": d["status"] == "edited",
            "basis": s["basis"], "speaker": " and ".join(dict.fromkeys(q["speaker_name"] for q in quotes)),
            "quotes": quotes,
        }
        earlier: Any = None
        history: list[dict[str, Any]] = []
        if f.kind == "one":
            prev = conn.execute(
                text(
                    "SELECT id, value, source, extra FROM record_values WHERE engagement_id = :e AND field = :f "
                    "AND subject IS NOT DISTINCT FROM :s AND current"
                ),
                {"e": engagement_id, "f": s["field"], "s": s.get("subject")},
            ).mappings().first()
            if prev:
                conn.execute(text("UPDATE record_values SET current = false WHERE id = :id"), {"id": prev["id"]})
                earlier = {"value": prev["value"], "source": prev["source"].get("label")}
                history = [*prev["extra"].get("history", []), earlier]
            else:
                on_record = st["existing"].get(review.record_key(s["field"], s.get("subject")))
                if on_record:
                    earlier = {"value": on_record["value"], "source": on_record.get("source")}
                    history = [earlier]
        extra: dict[str, Any] = {"history": history}
        if s.get("owners"):
            extra["owners"] = [review.name_of(st, o) for o in s["owners"]]
        if s.get("due"):
            extra["due"] = s["due"]
        if s.get("outcome"):
            extra["outcome"] = s["outcome"]
        conn.execute(
            text(
                "INSERT INTO record_values (agency_id, engagement_id, intake_id, section, field, subject, value, "
                "status, basis, quotes, source, extra) VALUES (:a, :e, :i, :section, :f, :s, :v, :status, :basis, "
                "CAST(:q AS jsonb), CAST(:src AS jsonb), CAST(:x AS jsonb))"
            ),
            {
                "a": agency, "e": engagement_id, "i": row["id"], "section": f.section, "f": s["field"],
                "s": s.get("subject"), "v": d["value"], "status": d["status"], "basis": s["basis"],
                "q": json.dumps(quotes), "src": json.dumps(source), "x": json.dumps(extra),
            },
        )
        log_field = f"{s['field']}:{s['subject']}" if s.get("subject") else s["field"]
        _log(conn, agency, "brief" if f.section == "brief" else f.section, engagement_id, log_field, d["value"], earlier, source)
        if s["field"] == "budgetTarget" and (amount := _budget_from(d["value"])):
            old = conn.execute(
                text("SELECT budget_aud FROM buyer_briefs WHERE engagement_id = :e"), {"e": engagement_id}
            ).scalar()
            conn.execute(
                text("UPDATE buyer_briefs SET budget_aud = :b WHERE engagement_id = :e"), {"b": amount, "e": engagement_id}
            )
            _log(conn, agency, "brief", engagement_id, "budget_aud", amount, old, source)
