"""Buying opportunities: created by hand, listed, and opened on their own page."""
import json
from collections.abc import Iterator
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import Connection, text

from buyers_desk.schemas import (
    ChangeLogEntry,
    Client,
    Engagement,
    EngagementSummary,
    NewBuyingOpportunity,
)

router = APIRouter(prefix="/api/engagements", tags=["engagements"])


def connection(request: Request) -> Iterator[Connection]:
    """One transaction per request, confined by the database to the configured agency."""
    agency = request.app.state.settings.agency_id
    if agency is None:
        raise HTTPException(status_code=403, detail="No agency: nothing can be read or written")
    with request.app.state.engine.begin() as conn:
        conn.execute(text("SELECT set_config('app.agency_id', :agency, true)"), {"agency": str(agency)})
        yield conn


Conn = Annotated[Connection, Depends(connection)]

OPPORTUNITY_STAGES = ("enquiry",)
ENTERED_BY_HAND = {"kind": "entered_by_hand"}
LOCAL_AGENT = "Local agent"  # single-user local app: no logins yet


@router.post("", status_code=201, response_model=Engagement)
def create_buying_opportunity(body: NewBuyingOpportunity, request: Request, conn: Conn) -> Engagement:
    agency = request.app.state.settings.agency_id
    person_id = conn.execute(
        text(
            "INSERT INTO persons (agency_id, name, email, mobile) "
            "VALUES (:agency, :name, :email, :mobile) RETURNING id"
        ),
        {"agency": agency, **body.client.model_dump()},
    ).scalar_one()
    household_id = conn.execute(
        text("INSERT INTO households (agency_id, name) VALUES (:agency, :name) RETURNING id"),
        {"agency": agency, "name": body.household_name},
    ).scalar_one()
    conn.execute(
        text(
            "INSERT INTO household_members (agency_id, household_id, person_id) "
            "VALUES (:agency, :household, :person)"
        ),
        {"agency": agency, "household": household_id, "person": person_id},
    )
    engagement_id = conn.execute(
        text(
            "INSERT INTO engagements (agency_id, service_line, stage, household_id) "
            "VALUES (:agency, 'buying', :stage, :household) RETURNING id"
        ),
        {"agency": agency, "stage": OPPORTUNITY_STAGES[0], "household": household_id},
    ).scalar_one()
    conn.execute(
        text(
            "INSERT INTO engagement_clients (agency_id, engagement_id, person_id) "
            "VALUES (:agency, :engagement, :person)"
        ),
        {"agency": agency, "engagement": engagement_id, "person": person_id},
    )
    conn.execute(
        text(
            "INSERT INTO buyer_briefs (agency_id, engagement_id, budget_aud) "
            "VALUES (:agency, :engagement, :budget)"
        ),
        {"agency": agency, "engagement": engagement_id, "budget": body.budget_aud},
    )
    _log_entered_by_hand(conn, agency, "household", household_id, {"name": body.household_name})
    _log_entered_by_hand(conn, agency, "client", person_id, body.client.model_dump(exclude_none=True))
    if body.budget_aud is not None:
        _log_entered_by_hand(conn, agency, "brief", engagement_id, {"budget_aud": body.budget_aud})
    return _read(conn, engagement_id)


@router.get("", response_model=list[EngagementSummary])
def list_engagements(conn: Conn) -> list[EngagementSummary]:
    ids = conn.execute(text("SELECT id FROM engagements ORDER BY created_at DESC, id")).scalars().all()
    return [_read(conn, i) for i in ids]


@router.get("/{engagement_id}", response_model=Engagement)
def get_engagement(engagement_id: UUID, conn: Conn) -> Engagement:
    return _read(conn, engagement_id)


def _read(conn: Connection, engagement_id: UUID) -> Engagement:
    row = conn.execute(
        text(
            "SELECT e.id, e.service_line, e.stage, e.created_at, h.name AS household_name, "
            "b.budget_aud FROM engagements e "
            "JOIN households h ON h.id = e.household_id "
            "LEFT JOIN buyer_briefs b ON b.engagement_id = e.id WHERE e.id = :id"
        ),
        {"id": engagement_id},
    ).mappings().first()
    if row is None:
        raise HTTPException(status_code=404, detail="No such engagement")
    clients = [
        Client(**c)
        for c in conn.execute(
            text(
                "SELECT p.id, p.name, p.email, p.mobile FROM engagement_clients ec "
                "JOIN persons p ON p.id = ec.person_id WHERE ec.engagement_id = :id "
                "ORDER BY p.created_at, p.id"
            ),
            {"id": engagement_id},
        ).mappings()
    ]
    return Engagement(**row, client_names=[c.name for c in clients], clients=clients)


@router.get("/{engagement_id}/changes", response_model=list[ChangeLogEntry])
def get_changes(engagement_id: UUID, conn: Conn) -> list[ChangeLogEntry]:
    """Every logged change to the values on this engagement's record, oldest first."""
    _read(conn, engagement_id)  # 404 if there is no such engagement
    rows = conn.execute(
        text(
            "SELECT c.entity, c.entity_id, c.field, c.new_value, c.earlier_value, c.source, "
            "c.changed_by, c.changed_at FROM change_log c, engagements e "
            "WHERE e.id = :id AND ("
            " (c.entity = 'brief' AND c.entity_id = e.id)"
            " OR (c.entity = 'household' AND c.entity_id = e.household_id)"
            " OR (c.entity = 'client' AND c.entity_id IN "
            "     (SELECT person_id FROM engagement_clients WHERE engagement_id = e.id)))"
            "ORDER BY c.id"
        ),
        {"id": engagement_id},
    ).mappings()
    return [ChangeLogEntry(**row) for row in rows]


def _log_entered_by_hand(
    conn: Connection, agency: UUID | None, entity: str, entity_id: UUID, values: dict[str, Any]
) -> None:
    for field, value in values.items():
        conn.execute(
            text(
                "INSERT INTO change_log "
                "(agency_id, entity, entity_id, field, new_value, source, changed_by) "
                "VALUES (:agency, :entity, :entity_id, :field, CAST(:value AS jsonb), "
                "CAST(:source AS jsonb), :by)"
            ),
            {
                "agency": agency,
                "entity": entity,
                "entity_id": entity_id,
                "field": field,
                "value": json.dumps(value),
                "source": json.dumps(ENTERED_BY_HAND),
                "by": LOCAL_AGENT,
            },
        )
