"""An agency-wide directory of professionals, linked to engagements with a role. One person is one
record, whether a client, a professional or both."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import Connection, text

from buyers_desk.engagements import Conn, _read
from buyers_desk.people import _log_change, _matches, _refuse_duplicates
from buyers_desk.schemas import (
    EngagementProfessionals,
    LinkedProfessional,
    LinkProfessional,
    NewProfessional,
    ProDetail,
    ProEngagement,
    ProfessionalPatch,
    ProfessionalProfile,
    ProSummary,
)

router = APIRouter(prefix="/api", tags=["professionals"])

_SELECT = (
    "SELECT p.id, p.name, p.email, p.mobile, pr.kind, pr.firm, pr.notes, "
    "(SELECT count(*) FROM engagement_professionals ep WHERE ep.person_id = p.id AND ep.ended_on IS NULL) AS engagement_count "
    "FROM professionals pr JOIN persons p ON p.id = pr.person_id"
)


def infer_kind(role: str) -> str:
    low = role.lower()
    for needle, kind in (("broker", "broker"), ("selling", "selling_agent"), ("agent", "selling_agent"), ("conveyanc", "conveyancer"),
                         ("solicitor", "solicitor"), ("inspect", "inspector"), ("refer", "referrer")):
        if needle in low:
            return kind
    return "other"


def _summary(conn: Connection, person_id: UUID) -> dict[str, Any]:
    row = conn.execute(text(_SELECT + " WHERE p.id = :id"), {"id": person_id}).mappings().first()  # noqa: S608
    if row is None:
        raise HTTPException(status_code=404, detail="No such professional")
    return dict(row)


@router.post("/professionals", status_code=201, response_model=ProSummary)
def create_professional(body: NewProfessional, request: Request, conn: Conn) -> ProSummary:
    if not body.confirm_duplicate:
        _refuse_duplicates(_matches(conn, body.email, body.mobile, None))
    agency = request.app.state.settings.agency_id
    person_id = conn.execute(
        text("INSERT INTO persons (agency_id, name, email, mobile) VALUES (:a, :n, :e, :m) RETURNING id"),
        {"a": agency, "n": body.name, "e": body.email, "m": body.mobile},
    ).scalar_one()
    conn.execute(
        text("INSERT INTO professionals (person_id, agency_id, kind, firm, notes) VALUES (:p, :a, :k, :f, :n)"),
        {"p": person_id, "a": agency, "k": body.kind, "f": body.firm, "n": body.notes},
    )
    _log_change(conn, agency, "client", person_id, "professional", {"kind": body.kind, "firm": body.firm}, None)
    return ProSummary(**_summary(conn, person_id))


@router.put("/professionals/{person_id}", response_model=ProSummary)
def make_professional(person_id: UUID, body: ProfessionalProfile, request: Request, conn: Conn) -> ProSummary:
    if conn.execute(text("SELECT 1 FROM persons WHERE id = :id"), {"id": person_id}).first() is None:
        raise HTTPException(status_code=404, detail="No such person")
    agency = request.app.state.settings.agency_id
    conn.execute(
        text(
            "INSERT INTO professionals (person_id, agency_id, kind, firm, notes) VALUES (:p, :a, :k, :f, :n) "
            "ON CONFLICT (person_id) DO UPDATE SET kind = EXCLUDED.kind, firm = EXCLUDED.firm, notes = EXCLUDED.notes"
        ),
        {"p": person_id, "a": agency, "k": body.kind, "f": body.firm, "n": body.notes},
    )
    _log_change(conn, agency, "client", person_id, "professional", {"kind": body.kind, "firm": body.firm}, None)
    return ProSummary(**_summary(conn, person_id))


@router.get("/professionals", response_model=list[ProSummary])
def list_professionals(conn: Conn, q: str | None = None, kind: str | None = None) -> list[ProSummary]:
    rows = conn.execute(
        text(
            _SELECT + " WHERE (CAST(:k AS text) IS NULL OR pr.kind = :k) AND (CAST(:q AS text) IS NULL "  # noqa: S608
            "OR p.name ILIKE '%' || CAST(:q AS text) || '%' OR pr.firm ILIKE '%' || CAST(:q AS text) || '%') ORDER BY p.name, p.id LIMIT 200"
        ),
        {"q": (q or "").strip() or None, "k": kind},
    ).mappings()
    return [ProSummary(**r) for r in rows]


@router.get("/professionals/{person_id}", response_model=ProDetail)
def get_professional(person_id: UUID, conn: Conn) -> ProDetail:
    summary = _summary(conn, person_id)
    rows = conn.execute(
        text(
            "SELECT e.id AS engagement_id, h.name AS household_name, ep.role, CAST(ep.started_on AS text) AS started_on, "
            "CAST(ep.ended_on AS text) AS ended_on FROM engagement_professionals ep JOIN engagements e ON e.id = ep.engagement_id "
            "JOIN households h ON h.id = e.household_id WHERE ep.person_id = :p ORDER BY ep.started_on, e.id"
        ),
        {"p": person_id},
    ).mappings()
    return ProDetail(**summary, engagements=[ProEngagement(**r) for r in rows])


@router.patch("/professionals/{person_id}", response_model=ProSummary)
def edit_professional(person_id: UUID, body: ProfessionalPatch, request: Request, conn: Conn) -> ProSummary:
    current = _summary(conn, person_id)
    agency = request.app.state.settings.agency_id
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None or value == current[field]:
            continue
        conn.execute(text(f"UPDATE professionals SET {field} = :v WHERE person_id = :p"), {"v": value, "p": person_id})  # noqa: S608
        _log_change(conn, agency, "client", person_id, f"professional.{field}", value, current[field])
    return ProSummary(**_summary(conn, person_id))


# ---- On an engagement ---------------------------------------------------------------------------------------------------


@router.post("/engagements/{engagement_id}/professionals", status_code=201, response_model=EngagementProfessionals)
def link_professional(engagement_id: UUID, body: LinkProfessional, request: Request, conn: Conn) -> EngagementProfessionals:
    _read(conn, engagement_id)
    _summary(conn, body.person_id)
    existing = conn.execute(
        text("SELECT ended_on FROM engagement_professionals WHERE engagement_id = :e AND person_id = :p"),
        {"e": engagement_id, "p": body.person_id},
    ).mappings().first()
    if existing and existing["ended_on"] is None:
        raise HTTPException(status_code=409, detail="They are already on this engagement")
    agency = request.app.state.settings.agency_id
    if existing:  # back again after being removed
        conn.execute(
            text("UPDATE engagement_professionals SET ended_on = NULL, started_on = current_date, role = :r WHERE engagement_id = :e AND person_id = :p"),
            {"e": engagement_id, "p": body.person_id, "r": body.role},
        )
    else:
        conn.execute(
            text("INSERT INTO engagement_professionals (agency_id, engagement_id, person_id, role) VALUES (:a, :e, :p, :r)"),
            {"a": agency, "e": engagement_id, "p": body.person_id, "r": body.role},
        )
    _log_change(conn, agency, "profile", engagement_id, "professional_linked", {"person": str(body.person_id), "role": body.role}, None)
    return _engagement_pros(conn, engagement_id)


@router.get("/engagements/{engagement_id}/professionals", response_model=EngagementProfessionals)
def engagement_professionals(engagement_id: UUID, conn: Conn) -> EngagementProfessionals:
    _read(conn, engagement_id)
    return _engagement_pros(conn, engagement_id)


@router.post("/engagements/{engagement_id}/professionals/{person_id}/end", response_model=EngagementProfessionals)
def end_link(engagement_id: UUID, person_id: UUID, request: Request, conn: Conn) -> EngagementProfessionals:
    _read(conn, engagement_id)
    done = conn.execute(
        text("UPDATE engagement_professionals SET ended_on = current_date WHERE engagement_id = :e AND person_id = :p AND ended_on IS NULL"),
        {"e": engagement_id, "p": person_id},
    )
    if done.rowcount == 0:
        raise HTTPException(status_code=409, detail="They are not currently on this engagement")
    _log_change(conn, request.app.state.settings.agency_id, "profile", engagement_id, "professional_unlinked", {"person": str(person_id)}, None)
    return _engagement_pros(conn, engagement_id)


def _engagement_pros(conn: Connection, engagement_id: UUID) -> EngagementProfessionals:
    rows = conn.execute(
        text(
            "SELECT p.id AS person_id, p.name, ep.role, coalesce(pr.kind, 'other') AS kind, pr.firm, "
            "CAST(ep.started_on AS text) AS started_on, CAST(ep.ended_on AS text) AS ended_on "
            "FROM engagement_professionals ep JOIN persons p ON p.id = ep.person_id "
            "LEFT JOIN professionals pr ON pr.person_id = p.id WHERE ep.engagement_id = :e ORDER BY ep.started_on, p.name"
        ),
        {"e": engagement_id},
    ).mappings().all()
    items = [LinkedProfessional(**r) for r in rows]
    return EngagementProfessionals(current=[i for i in items if i.ended_on is None], former=[i for i in items if i.ended_on is not None])
