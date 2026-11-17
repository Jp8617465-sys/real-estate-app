"""Properties, their place in an engagement (status, assessment) and checks against the brief.
Unknown facts stay unknown; partial addresses stay partial."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import Connection, text

from buyers_desk.engagements import Conn, _read
from buyers_desk.people import _log_change
from buyers_desk.schemas import (
    AttachProperty,
    CheckView,
    EngagementProperty,
    EngagementPropertyPatch,
    Fit,
    NewCheck,
    NewProperty,
    Property,
    PropertyPatch,
    ShortlistView,
)

router = APIRouter(prefix="/api", tags=["properties"])

_COLUMNS = "id, address_line, suburb, state, postcode, property_type, bedrooms, bathrooms, parking, land_m2, price_guide_low, price_guide_high, listing_url, notes, source"
_PATCHABLE = ("address_line", "suburb", "state", "postcode", "property_type", "bedrooms", "bathrooms", "parking", "land_m2", "price_guide_low", "price_guide_high", "listing_url", "notes")


def _property(conn: Connection, property_id: UUID) -> dict[str, Any]:
    row = conn.execute(text(f"SELECT {_COLUMNS} FROM properties WHERE id = :id"), {"id": property_id}).mappings().first()  # noqa: S608
    if row is None:
        raise HTTPException(status_code=404, detail="No such property")
    return dict(row)


@router.post("/properties", status_code=201, response_model=Property)
def create_property(body: NewProperty, request: Request, conn: Conn) -> Property:
    if not body.confirm_duplicate:
        dups = conn.execute(
            text(f"SELECT {_COLUMNS} FROM properties WHERE lower(address_line) = lower(:a) AND lower(coalesce(suburb, '')) = lower(coalesce(:s, ''))"),  # noqa: S608
            {"a": body.address_line, "s": body.suburb},
        ).mappings().all()
        if dups:
            raise HTTPException(
                status_code=409,
                detail={"message": "That property is already recorded. Open it, or confirm this is a different one.",
                        "matches": [{**d, "id": str(d["id"])} for d in dups]},
            )
    values = body.model_dump(exclude={"confirm_duplicate"})
    row = conn.execute(
        text(
            "INSERT INTO properties (agency_id, " + ", ".join(values) + ") VALUES (:agency, " + ", ".join(f":{k}" for k in values) + f") RETURNING {_COLUMNS}"  # noqa: S608
        ),
        {"agency": request.app.state.settings.agency_id, **values},
    ).mappings().one()
    return Property(**row)


@router.get("/properties", response_model=list[Property])
def search_properties(conn: Conn, q: str | None = None) -> list[Property]:
    rows = conn.execute(
        text(
            f"SELECT {_COLUMNS} FROM properties WHERE CAST(:q AS text) IS NULL OR address_line ILIKE '%' || CAST(:q AS text) || '%' "  # noqa: S608
            "OR suburb ILIKE '%' || CAST(:q AS text) || '%' ORDER BY address_line, id LIMIT 200"
        ),
        {"q": (q or "").strip() or None},
    ).mappings()
    return [Property(**r) for r in rows]


@router.get("/properties/{property_id}", response_model=Property)
def get_property(property_id: UUID, conn: Conn) -> Property:
    return Property(**_property(conn, property_id))


@router.patch("/properties/{property_id}", response_model=Property)
def edit_property(property_id: UUID, body: PropertyPatch, conn: Conn) -> Property:
    _property(conn, property_id)
    changes = {k: v for k, v in body.model_dump(exclude_unset=True).items() if k in _PATCHABLE}
    if changes.get("address_line", "x") is None:
        raise HTTPException(status_code=422, detail="An address cannot be cleared")
    for k, v in changes.items():
        conn.execute(text(f"UPDATE properties SET {k} = :v WHERE id = :id"), {"v": v, "id": property_id})  # noqa: S608
    return Property(**_property(conn, property_id))


# ---- In an engagement ----------------------------------------------------------------------------------------------


def _budget_fit(low: int | None, high: int | None, budget: int | None) -> str:
    if budget is None or (low is None and high is None):
        return "unknown"
    lo = low if low is not None else high
    hi = high if high is not None else low
    assert lo is not None and hi is not None
    if lo > budget:
        return "over"
    return "within" if hi <= budget else "stretch"


def _view(conn: Connection, ep_id: UUID) -> EngagementProperty:
    row = conn.execute(
        text("SELECT ep.id, ep.engagement_id, ep.property_id, ep.status, ep.assessment, ep.reasons, b.budget_aud "
             "FROM engagement_properties ep LEFT JOIN buyer_briefs b ON b.engagement_id = ep.engagement_id WHERE ep.id = :id"),
        {"id": ep_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such property in this engagement")
    prop = _property(conn, row["property_id"])
    checks = conn.execute(
        text("SELECT id, criterion, result, note FROM property_checks WHERE engagement_property_id = :id ORDER BY created_at, id"),
        {"id": ep_id},
    ).mappings().all()
    fit = {k: sum(1 for c in checks if c["result"] == k) for k in ("meets", "partly", "fails", "unknown")}
    return EngagementProperty(
        id=row["id"], engagement_id=row["engagement_id"], property=Property(**prop), status=row["status"],
        assessment=row["assessment"], reasons=row["reasons"], checks=[CheckView(**c) for c in checks],
        fit=Fit(**fit), budget_fit=_budget_fit(prop["price_guide_low"], prop["price_guide_high"], row["budget_aud"]),
    )


def _link(conn: Connection, engagement_id: UUID, ep_id: UUID) -> None:
    found = conn.execute(
        text("SELECT 1 FROM engagement_properties WHERE id = :id AND engagement_id = :e"), {"id": ep_id, "e": engagement_id}
    ).first()
    if not found:
        raise HTTPException(status_code=404, detail="No such property in this engagement")


@router.post("/engagements/{engagement_id}/properties", status_code=201, response_model=EngagementProperty)
def attach_property(engagement_id: UUID, body: AttachProperty, request: Request, conn: Conn) -> EngagementProperty:
    _read(conn, engagement_id)
    prop = _property(conn, body.property_id)
    if conn.execute(
        text("SELECT 1 FROM engagement_properties WHERE engagement_id = :e AND property_id = :p"),
        {"e": engagement_id, "p": body.property_id},
    ).first():
        raise HTTPException(status_code=409, detail="That property is already in this engagement")
    agency = request.app.state.settings.agency_id
    ep_id = conn.execute(
        text("INSERT INTO engagement_properties (agency_id, engagement_id, property_id, status) VALUES (:a, :e, :p, :s) RETURNING id"),
        {"a": agency, "e": engagement_id, "p": body.property_id, "s": body.status},
    ).scalar_one()
    _log_change(conn, agency, "properties", engagement_id, f"property:{prop['address_line']}:status", body.status, None)
    return _view(conn, ep_id)


@router.get("/engagements/{engagement_id}/properties", response_model=ShortlistView)
def list_engagement_properties(engagement_id: UUID, conn: Conn, status: str | None = None) -> ShortlistView:
    _read(conn, engagement_id)
    ids = conn.execute(
        text("SELECT id FROM engagement_properties WHERE engagement_id = :e AND (CAST(:s AS text) IS NULL OR status = :s) ORDER BY created_at, id"),
        {"e": engagement_id, "s": status},
    ).scalars().all()
    suggested: list[str] = []
    rows = conn.execute(
        text("SELECT field, value FROM record_values WHERE engagement_id = :e AND current AND field IN ('dealBreakers', 'mustHaves', 'bedrooms') ORDER BY created_at, id"),
        {"e": engagement_id},
    ).mappings().all()
    for field, label in (("dealBreakers", "Deal-breaker"), ("mustHaves", "Must-have"), ("bedrooms", "Bedrooms")):
        suggested += [f"{label}: {r['value']}" for r in rows if r["field"] == field]
    return ShortlistView(properties=[_view(conn, i) for i in ids], suggested_criteria=suggested)


@router.patch("/engagements/{engagement_id}/properties/{ep_id}", response_model=EngagementProperty)
def edit_engagement_property(engagement_id: UUID, ep_id: UUID, body: EngagementPropertyPatch, request: Request, conn: Conn) -> EngagementProperty:
    _read(conn, engagement_id)
    _link(conn, engagement_id, ep_id)
    before = _view(conn, ep_id)
    agency = request.app.state.settings.agency_id
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None or value == getattr(before, field):
            continue
        conn.execute(text(f"UPDATE engagement_properties SET {field} = :v WHERE id = :id"), {"v": value, "id": ep_id})  # noqa: S608
        _log_change(conn, agency, "properties", engagement_id, f"property:{before.property.address_line}:{field}", value, getattr(before, field))
    return _view(conn, ep_id)


@router.put("/engagements/{engagement_id}/properties/{ep_id}/checks", response_model=EngagementProperty)
def set_check(engagement_id: UUID, ep_id: UUID, body: NewCheck, request: Request, conn: Conn) -> EngagementProperty:
    _read(conn, engagement_id)
    _link(conn, engagement_id, ep_id)
    agency = request.app.state.settings.agency_id
    conn.execute(
        text(
            "INSERT INTO property_checks (agency_id, engagement_property_id, criterion, result, note) VALUES (:a, :ep, :c, :r, :n) "
            "ON CONFLICT (engagement_property_id, criterion) DO UPDATE SET result = EXCLUDED.result, note = EXCLUDED.note"
        ),
        {"a": agency, "ep": ep_id, "c": body.criterion.strip(), "r": body.result, "n": body.note},
    )
    return _view(conn, ep_id)
