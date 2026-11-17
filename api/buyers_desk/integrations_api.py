"""The integration ports through the product API. Everything here is synthetic until a provider is
chosen; each response says so."""
import json
from datetime import UTC, date, datetime, timedelta
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from buyers_desk.engagements import Conn, _read
from buyers_desk.integrations.models import DriveTime, GeoResult, IntegrationInfo, PropertyRecord, Slot
from buyers_desk.people import _log_change, _person_row
from buyers_desk.properties import _PATCHABLE, _property
from buyers_desk.schemas import (
    BookCall,
    CallBooked,
    CommunicationView,
    EnrichResult,
    IdentityCheckView,
    NewCommunication,
    NewIdentityCheck,
    Property,
    PropertyLookup,
    SlotProposal,
)

router = APIRouter(prefix="/api/v1", tags=["integrations"])


def _ports(request: Request) -> Any:
    return request.app.state.integrations


@router.get("/integrations", response_model=list[IntegrationInfo])
def integrations(request: Request) -> list[IntegrationInfo]:
    return list(_ports(request).describe())


@router.post("/integrations/property-data/lookup", response_model=PropertyRecord)
def lookup(body: PropertyLookup, request: Request) -> PropertyRecord:
    record = _ports(request).property_data.lookup(body.address_line, body.suburb)
    if record is None:
        raise HTTPException(status_code=404, detail="The property data source has nothing for that address")
    return record  # type: ignore[no-any-return]


@router.get("/integrations/property-data/comparables", response_model=list[PropertyRecord])
def comparables(request: Request, suburb: str, bedrooms: int | None = None, limit: int = 5) -> list[PropertyRecord]:
    return list(_ports(request).property_data.comparables(suburb, bedrooms, min(max(limit, 1), 20)))


@router.post("/properties/{property_id}/enrich", response_model=EnrichResult)
def enrich(property_id: UUID, request: Request, conn: Conn) -> EnrichResult:
    """Fill a property's empty facts from the data source. Anything already entered is kept."""
    prop = _property(conn, property_id)
    record = _ports(request).property_data.lookup(prop["address_line"], prop["suburb"])
    if record is None:
        raise HTTPException(status_code=404, detail="The property data source has nothing for that address")
    filled: list[str] = []
    kept: list[str] = []
    for name, fact in record.facts.items():
        if name not in _PATCHABLE:
            continue
        if prop.get(name) is None:
            conn.execute(text(f"UPDATE properties SET {name} = :v WHERE id = :id"), {"v": fact.value, "id": property_id})  # noqa: S608
            filled.append(name)
        else:
            kept.append(name)
    if filled:
        label = f"{prop['source']} + synthetic property data (retrieved {datetime.now(UTC).date().isoformat()})"
        conn.execute(text("UPDATE properties SET source = :s WHERE id = :id"), {"s": label, "id": property_id})
        _log_change(conn, request.app.state.settings.agency_id, "property", property_id, "enriched", {"filled": filled}, None)
    return EnrichResult(property=Property(**_property(conn, property_id)), filled=filled, kept=kept, not_available=list(record.missing))


@router.get("/integrations/maps/geocode", response_model=GeoResult)
def geocode(request: Request, suburb: str, address_line: str | None = None) -> GeoResult:
    found = _ports(request).maps.geocode(address_line, suburb)
    if found is None:
        raise HTTPException(status_code=404, detail="Unknown place")
    return found  # type: ignore[no-any-return]


@router.get("/integrations/maps/drive-time", response_model=DriveTime)
def drive_time(request: Request, from_place: str, to_place: str) -> DriveTime:
    return _ports(request).maps.drive_time(from_place, to_place)  # type: ignore[no-any-return]


# ---- Discovery call booking ---------------------------------------------------------------------------------------------------------


def _emails(conn: Conn, engagement_id: UUID) -> list[str]:
    return list(
        conn.execute(
            text("SELECT p.email FROM engagement_clients ec JOIN persons p ON p.id = ec.person_id WHERE ec.engagement_id = :e AND p.email IS NOT NULL ORDER BY p.created_at, p.id"),
            {"e": engagement_id},
        ).scalars()
    )


@router.post("/engagements/{engagement_id}/discovery-call/slots", response_model=SlotProposal)
def propose_slots(engagement_id: UUID, request: Request, conn: Conn) -> SlotProposal:
    _read(conn, engagement_id)
    attendees = _emails(conn, engagement_id)
    slots = _ports(request).mail_calendar.propose_slots(attendees, date.today() + timedelta(days=1), 6)
    return SlotProposal(attendees=attendees, slots=[s.model_dump(mode="json") for s in slots])


@router.post("/engagements/{engagement_id}/discovery-call/book", status_code=201, response_model=CallBooked)
def book_call(engagement_id: UUID, body: BookCall, request: Request, conn: Conn) -> CallBooked:
    engagement = _read(conn, engagement_id)
    agency = request.app.state.settings.agency_id
    attendees = _emails(conn, engagement_id)
    title = f"Discovery call: {engagement.household_name}"
    slot = Slot(start=body.start, end=body.start + timedelta(hours=1))
    invite = _ports(request).mail_calendar.create_invite(slot, attendees, title)
    stage = engagement.stage
    if stage in ("enquiry", "qualified"):
        conn.execute(text("UPDATE engagements SET stage = 'consultation', stage_changed_at = now() WHERE id = :id"), {"id": engagement_id})
        _log_change(conn, agency, "engagement", engagement_id, "stage", "consultation", stage)
        stage = "consultation"
    task_id = conn.execute(
        text("INSERT INTO tasks (agency_id, engagement_id, title, owner, due_on) VALUES (:a, :e, :t, 'Agent', :d) RETURNING id"),
        {"a": agency, "e": engagement_id, "t": title, "d": body.start.date()},
    ).scalar_one()
    conn.execute(
        text("INSERT INTO communications (agency_id, engagement_id, direction, channel, subject, body) VALUES (:a, :e, 'out', 'email', :s, :b)"),
        {"a": agency, "e": engagement_id, "s": f"Invitation: {title}", "b": f"Synthetic: nothing was sent. Invited {', '.join(attendees) or 'no one (no client email on record)'} for {body.start.isoformat()}."},
    )
    return CallBooked(uid=invite.uid, invite_ics=invite.ics, start=body.start, attendees=attendees, stage=stage, task_id=task_id, synthetic=invite.synthetic)


# ---- Communications -------------------------------------------------------------------------------------------------------------------


@router.post("/engagements/{engagement_id}/communications", status_code=201, response_model=CommunicationView)
def log_communication(engagement_id: UUID, body: NewCommunication, request: Request, conn: Conn) -> CommunicationView:
    _read(conn, engagement_id)
    row = conn.execute(
        text(
            "INSERT INTO communications (agency_id, engagement_id, direction, channel, subject, body) VALUES (:a, :e, :d, :c, :s, :b) "
            "RETURNING id, direction, channel, subject, body, occurred_at"
        ),
        {"a": request.app.state.settings.agency_id, "e": engagement_id, "d": body.direction, "c": body.channel, "s": body.subject.strip(), "b": body.body},
    ).mappings().one()
    return CommunicationView(**row)


@router.get("/engagements/{engagement_id}/communications", response_model=list[CommunicationView])
def list_communications(engagement_id: UUID, conn: Conn) -> list[CommunicationView]:
    _read(conn, engagement_id)
    rows = conn.execute(
        text("SELECT id, direction, channel, subject, body, occurred_at FROM communications WHERE engagement_id = :e ORDER BY occurred_at DESC, id"),
        {"e": engagement_id},
    ).mappings()
    return [CommunicationView(**r) for r in rows]


# ---- Identity checks ------------------------------------------------------------------------------------------------------------------------


@router.post("/people/{person_id}/identity-checks", status_code=201, response_model=IdentityCheckView)
def run_identity_check(person_id: UUID, body: NewIdentityCheck, request: Request, conn: Conn) -> IdentityCheckView:
    person = _person_row(conn, person_id)
    result = _ports(request).identity.start_check(person["name"], body.kind)
    row = conn.execute(
        text(
            "INSERT INTO identity_checks (agency_id, person_id, kind, status, provider, reference, evidence, synthetic) "
            "VALUES (:a, :p, :k, :s, :pr, :r, CAST(:e AS jsonb), :syn) RETURNING id, kind, status, provider, reference, evidence, synthetic, created_at"
        ),
        {"a": request.app.state.settings.agency_id, "p": person_id, "k": result.kind, "s": result.status, "pr": result.provider,
         "r": result.reference, "e": json.dumps(result.evidence), "syn": result.synthetic},
    ).mappings().one()
    _log_change(conn, request.app.state.settings.agency_id, "client", person_id, "identity_check", {"kind": result.kind, "status": result.status, "synthetic": result.synthetic}, None)
    return IdentityCheckView(**row)


@router.get("/people/{person_id}/identity-checks", response_model=list[IdentityCheckView])
def list_identity_checks(person_id: UUID, conn: Conn) -> list[IdentityCheckView]:
    _person_row(conn, person_id)
    rows = conn.execute(
        text("SELECT id, kind, status, provider, reference, evidence, synthetic, created_at FROM identity_checks WHERE person_id = :p ORDER BY created_at DESC, id"),
        {"p": person_id},
    ).mappings()
    return [IdentityCheckView(**r) for r in rows]
