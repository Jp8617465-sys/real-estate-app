"""Clients and households: people found by name, email or mobile, grouped in dated households,
linked by typed relationships. A match on email or mobile is shown and must be confirmed; people
are never silently merged."""
import json
from datetime import date
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import Connection, text

from buyers_desk.engagements import LOCAL_AGENT, Conn, _log_entered_by_hand, _read
from buyers_desk.paging import PageDep, paginate
from buyers_desk.schemas import (
    AddMember,
    ChangeLogEntry,
    Engagement,
    EndMembership,
    HouseholdOpportunity,
    HouseholdSummary,
    HouseholdView,
    NewHousehold,
    NewPerson,
    NewRelationship,
    PersonDetail,
    PersonEdit,
    PersonSummary,
)

router = APIRouter(prefix="/api/v1", tags=["people"])

_INVERSE = {"parent": "child", "child": "parent"}


def _matches(conn: Connection, email: str | None, mobile: str | None, exclude: UUID | None) -> list[dict[str, Any]]:
    rows = conn.execute(
        text(
            "SELECT id, name, email, mobile FROM persons WHERE (id IS DISTINCT FROM :exclude) AND ("
            " (CAST(:email AS text) IS NOT NULL AND lower(email) = lower(CAST(:email AS text)))"
            " OR (normalize_mobile(CAST(:mobile AS text)) <> '' AND normalize_mobile(mobile) = normalize_mobile(CAST(:mobile AS text)))"
            ") ORDER BY created_at, id"
        ),
        {"email": email, "mobile": mobile, "exclude": exclude},
    ).mappings()
    return [{**r, "household_names": _current_households(conn, r["id"])} for r in rows]


def _current_households(conn: Connection, person_id: UUID) -> list[str]:
    return list(
        conn.execute(
            text(
                "SELECT h.name FROM household_members m JOIN households h ON h.id = m.household_id "
                "WHERE m.person_id = :p AND m.ended_on IS NULL ORDER BY h.name"
            ),
            {"p": person_id},
        ).scalars()
    )


def _refuse_duplicates(matches: list[dict[str, Any]]) -> None:
    if matches:
        names = ", ".join(m["name"] for m in matches)
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"That email or mobile already belongs to {names}. Open that person, or confirm this is a different person.",
                "matches": [{**m, "id": str(m["id"])} for m in matches],
            },
        )


@router.post("/people", status_code=201, response_model=PersonSummary)
def create_person(body: NewPerson, request: Request, conn: Conn) -> PersonSummary:
    if not body.confirm_duplicate:
        _refuse_duplicates(_matches(conn, body.email, body.mobile, None))
    agency = request.app.state.settings.agency_id
    row = conn.execute(
        text(
            "INSERT INTO persons (agency_id, name, email, mobile) VALUES (:a, :name, :email, :mobile) "
            "RETURNING id, name, email, mobile"
        ),
        {"a": agency, "name": body.name, "email": body.email, "mobile": body.mobile},
    ).mappings().one()
    _log_entered_by_hand(conn, agency, "client", row["id"], {k: v for k, v in row.items() if k != "id" and v})
    return PersonSummary(**row, household_names=[])


@router.get("/people", response_model=list[PersonSummary])
def search_people(conn: Conn, response: Response, page: PageDep, q: str | None = None) -> list[PersonSummary]:
    rows = conn.execute(
        text(
            "SELECT id, name, email, mobile FROM persons WHERE CAST(:q AS text) IS NULL"
            " OR name ILIKE '%' || CAST(:q AS text) || '%' OR email ILIKE '%' || CAST(:q AS text) || '%'"
            " OR (length(normalize_mobile(CAST(:q AS text))) >= 3"
            "     AND normalize_mobile(mobile) LIKE '%' || normalize_mobile(CAST(:q AS text)) || '%')"
            " ORDER BY name, id LIMIT 5000"
        ),
        {"q": (q or "").strip() or None},
    ).mappings()
    found = paginate(list(rows), response, page)
    return [PersonSummary(**r, household_names=_current_households(conn, r["id"])) for r in found]


def _person_row(conn: Connection, person_id: UUID) -> dict[str, Any]:
    row = conn.execute(
        text("SELECT id, name, email, mobile FROM persons WHERE id = :id"), {"id": person_id}
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such person")
    return dict(row)


@router.get("/people/{person_id}", response_model=PersonDetail)
def get_person(person_id: UUID, conn: Conn) -> PersonDetail:
    return _detail(conn, person_id)


def _detail(conn: Connection, person_id: UUID) -> PersonDetail:
    person = _person_row(conn, person_id)
    households = conn.execute(
        text(
            "SELECT h.id AS household_id, h.name, CAST(m.started_on AS text) AS started_on, CAST(m.ended_on AS text) AS ended_on "
            "FROM household_members m JOIN households h ON h.id = m.household_id WHERE m.person_id = :p "
            "ORDER BY m.started_on, h.name"
        ),
        {"p": person_id},
    ).mappings().all()
    relationships = conn.execute(
        text(
            "SELECT r.id, r.other_person_id, p.name AS other_name, r.kind, r.note FROM relationships r "
            "JOIN persons p ON p.id = r.other_person_id WHERE r.person_id = :p "
            "UNION ALL "
            "SELECT r.id, r.person_id, p.name, CASE r.kind WHEN 'parent' THEN 'child' ELSE r.kind END, r.note "
            "FROM relationships r JOIN persons p ON p.id = r.person_id WHERE r.other_person_id = :p "
            "ORDER BY 3"
        ),
        {"p": person_id},
    ).mappings().all()
    engagements = conn.execute(
        text(
            "SELECT e.id, h.name AS household_name, e.stage FROM engagement_clients ec "
            "JOIN engagements e ON e.id = ec.engagement_id JOIN households h ON h.id = e.household_id "
            "WHERE ec.person_id = :p ORDER BY e.created_at, e.id"
        ),
        {"p": person_id},
    ).mappings().all()
    return PersonDetail(**person, households=list(households), relationships=list(relationships), engagements=list(engagements))  # type: ignore[arg-type]


@router.patch("/people/{person_id}", response_model=PersonSummary)
def edit_person(person_id: UUID, body: PersonEdit, request: Request, conn: Conn) -> PersonSummary:
    current = _person_row(conn, person_id)
    changes = {k: v for k, v in body.model_dump(exclude={"confirm_duplicate"}).items() if v is not None and v != current[k]}
    if ("email" in changes or "mobile" in changes) and not body.confirm_duplicate:
        _refuse_duplicates(_matches(conn, changes.get("email"), changes.get("mobile"), person_id))
    agency = request.app.state.settings.agency_id
    for field, value in changes.items():
        conn.execute(text(f"UPDATE persons SET {field} = :v WHERE id = :id"), {"v": value, "id": person_id})  # noqa: S608 (field names are from a fixed model)
        _log_change(conn, agency, "client", person_id, field, value, current[field])
    row = _person_row(conn, person_id)
    return PersonSummary(**row, household_names=_current_households(conn, person_id))


def _log_change(conn: Connection, agency: UUID | None, entity: str, entity_id: UUID, field: str, new: Any, earlier: Any) -> None:
    conn.execute(
        text(
            "INSERT INTO change_log (agency_id, entity, entity_id, field, new_value, earlier_value, source, changed_by) "
            "VALUES (:a, :e, :i, :f, CAST(:n AS jsonb), CAST(:o AS jsonb), CAST(:s AS jsonb), :by)"
        ),
        {
            "a": agency, "e": entity, "i": entity_id, "f": field, "n": json.dumps(new),
            "o": json.dumps(earlier) if earlier is not None else None,
            "s": json.dumps({"kind": "entered_by_hand"}), "by": LOCAL_AGENT,
        },
    )


@router.get("/people/{person_id}/changes", response_model=list[ChangeLogEntry])
def person_changes(person_id: UUID, conn: Conn) -> list[ChangeLogEntry]:
    _person_row(conn, person_id)
    rows = conn.execute(
        text(
            "SELECT entity, entity_id, field, new_value, earlier_value, source, changed_by, changed_at "
            "FROM change_log WHERE entity_id = :id AND entity IN ('client', 'household') ORDER BY id"
        ),
        {"id": person_id},
    ).mappings()
    return [ChangeLogEntry(**r) for r in rows]


@router.post("/people/{person_id}/relationships", status_code=201)
def add_relationship(person_id: UUID, body: NewRelationship, request: Request, conn: Conn) -> dict[str, str]:
    _person_row(conn, person_id)
    _person_row(conn, body.other_person_id)
    if body.other_person_id == person_id:
        raise HTTPException(status_code=422, detail="A person cannot be related to themselves")
    kind, a, b = body.kind, person_id, body.other_person_id
    if kind == "child":  # "b is a's child" is stored as "a is b's parent"
        kind, a, b = "parent", b, a
    elif kind in ("partner", "sibling"):  # symmetric: store one row, ids in order
        a, b = sorted((a, b), key=str)
    exists = conn.execute(
        text("SELECT 1 FROM relationships WHERE person_id = :a AND other_person_id = :b AND kind = :k"),
        {"a": a, "b": b, "k": kind},
    ).first()
    if exists:
        raise HTTPException(status_code=409, detail="That relationship is already recorded")
    agency = request.app.state.settings.agency_id
    new_id = conn.execute(
        text(
            "INSERT INTO relationships (agency_id, person_id, other_person_id, kind, note) "
            "VALUES (:ag, :a, :b, :k, :n) RETURNING id"
        ),
        {"ag": agency, "a": a, "b": b, "k": kind, "n": body.note},
    ).scalar_one()
    _log_change(conn, agency, "client", person_id, "relationship", {"with": str(body.other_person_id), "kind": body.kind}, None)
    return {"id": str(new_id)}


# ---- Households ----------------------------------------------------------------------------------------------


def _household_view(conn: Connection, household_id: UUID) -> HouseholdView:
    row = conn.execute(text("SELECT id, name FROM households WHERE id = :id"), {"id": household_id}).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such household")
    members = conn.execute(
        text(
            "SELECT m.person_id, p.name, CAST(m.started_on AS text) AS started_on, CAST(m.ended_on AS text) AS ended_on "
            "FROM household_members m JOIN persons p ON p.id = m.person_id WHERE m.household_id = :h "
            "ORDER BY m.started_on, p.name"
        ),
        {"h": household_id},
    ).mappings().all()
    engagements = conn.execute(
        text("SELECT e.id, h.name AS household_name, e.stage FROM engagements e JOIN households h ON h.id = e.household_id "
             "WHERE e.household_id = :h ORDER BY e.created_at, e.id"),
        {"h": household_id},
    ).mappings().all()
    return HouseholdView(
        **row,
        members=[m for m in members if m["ended_on"] is None],  # type: ignore[misc]
        former_members=[m for m in members if m["ended_on"] is not None],  # type: ignore[misc]
        engagements=list(engagements),  # type: ignore[arg-type]
    )


@router.post("/households", status_code=201, response_model=HouseholdView)
def create_household(body: NewHousehold, request: Request, conn: Conn) -> HouseholdView:
    agency = request.app.state.settings.agency_id
    for pid in body.member_ids:
        _person_row(conn, pid)
    household_id = conn.execute(
        text("INSERT INTO households (agency_id, name) VALUES (:a, :n) RETURNING id"), {"a": agency, "n": body.name}
    ).scalar_one()
    for pid in dict.fromkeys(body.member_ids):
        conn.execute(
            text("INSERT INTO household_members (agency_id, household_id, person_id) VALUES (:a, :h, :p)"),
            {"a": agency, "h": household_id, "p": pid},
        )
    _log_entered_by_hand(conn, agency, "household", household_id, {"name": body.name})
    return _household_view(conn, household_id)


@router.get("/households", response_model=list[HouseholdSummary])
def list_households(conn: Conn, response: Response, page: PageDep, q: str | None = None) -> list[HouseholdSummary]:
    rows = conn.execute(
        text("SELECT id, name FROM households WHERE CAST(:q AS text) IS NULL OR name ILIKE '%' || CAST(:q AS text) || '%' ORDER BY name, id LIMIT 5000"),
        {"q": (q or "").strip() or None},
    ).mappings()
    out = []
    for r in paginate(list(rows), response, page):
        names = conn.execute(
            text("SELECT p.name FROM household_members m JOIN persons p ON p.id = m.person_id WHERE m.household_id = :h AND m.ended_on IS NULL ORDER BY p.name"),
            {"h": r["id"]},
        ).scalars()
        out.append(HouseholdSummary(id=r["id"], name=r["name"], member_names=list(names)))
    return out


@router.get("/households/{household_id}", response_model=HouseholdView)
def get_household(household_id: UUID, conn: Conn) -> HouseholdView:
    return _household_view(conn, household_id)


@router.post("/households/{household_id}/members", response_model=HouseholdView)
def add_member(household_id: UUID, body: AddMember, request: Request, conn: Conn) -> HouseholdView:
    _household_view(conn, household_id)
    _person_row(conn, body.person_id)
    agency = request.app.state.settings.agency_id
    row = conn.execute(
        text("SELECT ended_on FROM household_members WHERE household_id = :h AND person_id = :p"),
        {"h": household_id, "p": body.person_id},
    ).mappings().first()
    if row and row["ended_on"] is None:
        raise HTTPException(status_code=409, detail="They are already in this household")
    if row:  # rejoining after leaving
        conn.execute(
            text("UPDATE household_members SET ended_on = NULL, started_on = current_date WHERE household_id = :h AND person_id = :p"),
            {"h": household_id, "p": body.person_id},
        )
    else:
        conn.execute(
            text("INSERT INTO household_members (agency_id, household_id, person_id) VALUES (:a, :h, :p)"),
            {"a": agency, "h": household_id, "p": body.person_id},
        )
    _log_change(conn, agency, "household", household_id, "member_added", str(body.person_id), None)
    return _household_view(conn, household_id)


@router.post("/households/{household_id}/members/{person_id}/end", response_model=HouseholdView)
def end_membership(household_id: UUID, person_id: UUID, body: EndMembership, request: Request, conn: Conn) -> HouseholdView:
    _household_view(conn, household_id)
    try:
        ended_on = date.fromisoformat(body.ended_on) if body.ended_on else date.today()
    except ValueError:
        raise HTTPException(status_code=422, detail="ended_on must be a date like 2026-03-01") from None
    done = conn.execute(
        text("UPDATE household_members SET ended_on = :d WHERE household_id = :h AND person_id = :p AND ended_on IS NULL"),
        {"d": ended_on, "h": household_id, "p": person_id},
    )
    if done.rowcount == 0:
        raise HTTPException(status_code=409, detail="They are not a current member of this household")
    _log_change(conn, request.app.state.settings.agency_id, "household", household_id, "member_ended", str(person_id), None)
    return _household_view(conn, household_id)


@router.post("/households/{household_id}/opportunities", status_code=201, response_model=Engagement)
def open_opportunity(household_id: UUID, body: HouseholdOpportunity, request: Request, conn: Conn) -> Engagement:
    view = _household_view(conn, household_id)
    if not view.members:
        raise HTTPException(status_code=409, detail="This household has no current member to open an opportunity for")
    agency = request.app.state.settings.agency_id
    engagement_id = conn.execute(
        text("INSERT INTO engagements (agency_id, service_line, stage, household_id) VALUES (:a, 'buying', 'enquiry', :h) RETURNING id"),
        {"a": agency, "h": household_id},
    ).scalar_one()
    for m in view.members:
        conn.execute(
            text("INSERT INTO engagement_clients (agency_id, engagement_id, person_id) VALUES (:a, :e, :p)"),
            {"a": agency, "e": engagement_id, "p": m.person_id},
        )
    conn.execute(
        text("INSERT INTO buyer_briefs (agency_id, engagement_id, budget_aud) VALUES (:a, :e, :b)"),
        {"a": agency, "e": engagement_id, "b": body.budget_aud},
    )
    if body.budget_aud is not None:
        _log_entered_by_hand(conn, agency, "brief", engagement_id, {"budget_aud": body.budget_aud})
    return _read(conn, engagement_id)
