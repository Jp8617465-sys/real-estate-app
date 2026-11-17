"""The buyer brief, editable by hand. Manual edits and values accepted from a call share one
record: each keeps its source and history, replaced values stay in the history, and every change
is in the change log."""
import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import Connection, text

from buyers_desk.engagements import Conn, _read
from buyers_desk.intake.fields import FIELDS, SECTIONS
from buyers_desk.intakes import _budget_from, _money
from buyers_desk.people import _log_change
from buyers_desk.schemas import BriefValue, BriefView, BriefField, BriefSection, NewBriefValue

router = APIRouter(prefix="/api/engagements", tags=["brief"])

BRIEF_SECTIONS = ("profile", "brief", "intake")
MANUAL = {"kind": "entered_by_hand", "label": "Entered by hand"}


def _field_or_404(field_id: str) -> Any:
    f = FIELDS.get(field_id)
    if f is None or f.section not in BRIEF_SECTIONS:
        raise HTTPException(status_code=404, detail=f"No such brief field {field_id!r}")
    return f


def _current(conn: Connection, engagement_id: UUID, field: str, subject: str | None) -> dict[str, Any] | None:
    row = conn.execute(
        text(
            "SELECT id, value, source, extra FROM record_values WHERE engagement_id = :e AND field = :f "
            "AND subject IS NOT DISTINCT FROM :s AND current ORDER BY created_at DESC LIMIT 1"
        ),
        {"e": engagement_id, "f": field, "s": subject},
    ).mappings().first()
    return dict(row) if row else None


def _insert(conn: Connection, agency: UUID | None, engagement_id: UUID, f: Any, value: str, subject: str | None, history: list[Any]) -> None:
    conn.execute(
        text(
            "INSERT INTO record_values (agency_id, engagement_id, section, field, subject, value, status, basis, quotes, source, extra) "
            "VALUES (:a, :e, :sec, :f, :s, :v, 'accepted', 'stated', '[]', CAST(:src AS jsonb), CAST(:x AS jsonb))"
        ),
        {"a": agency, "e": engagement_id, "sec": f.section, "f": f.id, "s": subject, "v": value,
         "src": json.dumps(MANUAL), "x": json.dumps({"history": history})},
    )


def _entity(f: Any) -> str:
    return "brief" if f.section == "brief" else f.section


@router.get("/{engagement_id}/brief", response_model=BriefView)
def get_brief(engagement_id: UUID, conn: Conn) -> BriefView:
    _read(conn, engagement_id)
    rows = conn.execute(
        text(
            "SELECT id, field, subject, value, status, basis, source, extra, created_at FROM record_values "
            "WHERE engagement_id = :e AND current AND section IN ('profile', 'brief', 'intake') ORDER BY created_at, id"
        ),
        {"e": engagement_id},
    ).mappings().all()
    budget = conn.execute(text("SELECT budget_aud FROM buyer_briefs WHERE engagement_id = :e"), {"e": engagement_id}).scalar()
    sections: list[BriefSection] = []
    not_covered: list[str] = []
    for key, label in SECTIONS:
        if key not in BRIEF_SECTIONS:
            continue
        fields: list[BriefField] = []
        for f in (x for x in FIELDS.values() if x.section == key):
            values = [
                BriefValue(
                    id=r["id"], value=r["value"], subject=r["subject"], status=r["status"], basis=r["basis"],
                    source=r["source"].get("label", ""), history=r["extra"].get("history", []), recorded_at=r["created_at"],
                )
                for r in rows if r["field"] == f.id
            ]
            if f.id == "budgetTarget" and not values and budget:
                values = [BriefValue(id=None, value=_money(budget), subject=None, status="on record", basis=None,
                                     source="Entered by hand", history=[], recorded_at=None)]
            if not values and f.id != "notes":
                not_covered.append(f.label)
            fields.append(BriefField(id=f.id, label=f.label, item=f.item, kind=f.kind, group=f.group, per_person=f.per_person, values=values))
        sections.append(BriefSection(key=key, label=label, fields=fields))
    return BriefView(engagement_id=engagement_id, sections=sections, not_covered=not_covered)


@router.put("/{engagement_id}/brief/{field_id}", response_model=BriefView)
def set_value(engagement_id: UUID, field_id: str, body: NewBriefValue, request: Request, conn: Conn) -> BriefView:
    _read(conn, engagement_id)
    f = _field_or_404(field_id)
    if f.kind != "one":
        raise HTTPException(status_code=422, detail=f"{f.label} takes several values: add or remove them one at a time")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=422, detail="A value cannot be empty")
    subject = (body.subject or "").strip() or None
    agency = request.app.state.settings.agency_id
    prev = _current(conn, engagement_id, field_id, subject)
    history: list[Any] = []
    earlier: Any = None
    if prev:
        conn.execute(text("UPDATE record_values SET current = false WHERE id = :id"), {"id": prev["id"]})
        earlier = prev["value"]
        history = [*prev["extra"].get("history", []), {"value": prev["value"], "source": prev["source"].get("label")}]
    elif field_id == "budgetTarget":
        old = conn.execute(text("SELECT budget_aud FROM buyer_briefs WHERE engagement_id = :e"), {"e": engagement_id}).scalar()
        if old:
            earlier = _money(old)
            history = [{"value": earlier, "source": "Entered by hand"}]
    _insert(conn, agency, engagement_id, f, value, subject, history)
    _log_change(conn, agency, _entity(f), engagement_id, f"{field_id}:{subject}" if subject else field_id, value, earlier)
    if field_id == "budgetTarget" and (amount := _budget_from(value)):
        old_budget = conn.execute(text("SELECT budget_aud FROM buyer_briefs WHERE engagement_id = :e"), {"e": engagement_id}).scalar()
        conn.execute(text("UPDATE buyer_briefs SET budget_aud = :b WHERE engagement_id = :e"), {"b": amount, "e": engagement_id})
        _log_change(conn, agency, "brief", engagement_id, "budget_aud", amount, old_budget)
    return get_brief(engagement_id, conn)


@router.post("/{engagement_id}/brief/{field_id}/values", status_code=201, response_model=BriefView)
def add_value(engagement_id: UUID, field_id: str, body: NewBriefValue, request: Request, conn: Conn) -> BriefView:
    _read(conn, engagement_id)
    f = _field_or_404(field_id)
    if f.kind != "many":
        raise HTTPException(status_code=422, detail=f"{f.label} holds one value: set it instead of adding")
    value = body.value.strip()
    if not value:
        raise HTTPException(status_code=422, detail="A value cannot be empty")
    agency = request.app.state.settings.agency_id
    _insert(conn, agency, engagement_id, f, value, (body.subject or "").strip() or None, [])
    _log_change(conn, agency, _entity(f), engagement_id, field_id, value, None)
    return get_brief(engagement_id, conn)


@router.delete("/{engagement_id}/brief/values/{value_id}", response_model=BriefView)
def remove_value(engagement_id: UUID, value_id: UUID, request: Request, conn: Conn) -> BriefView:
    _read(conn, engagement_id)
    row = conn.execute(
        text("SELECT field, value FROM record_values WHERE id = :id AND engagement_id = :e AND current"),
        {"id": value_id, "e": engagement_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such current value")
    conn.execute(text("UPDATE record_values SET current = false WHERE id = :id"), {"id": value_id})
    _log_change(conn, request.app.state.settings.agency_id, _entity(FIELDS[row["field"]]), engagement_id, row["field"], None, row["value"])
    return get_brief(engagement_id, conn)
