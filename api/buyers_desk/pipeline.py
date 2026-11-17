"""The engagement pipeline: provisional stages (pilot validation will settle them), moves that
are logged with who and when, and a board. Stage names follow GLOSSARY.md's two pipelines."""
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request
from sqlalchemy import text

from buyers_desk.engagements import Conn, _log_entered_by_hand, _read
from buyers_desk.people import _log_change
from buyers_desk.schemas import (
    Board,
    BoardCard,
    BoardColumn,
    ChangeLogEntry,
    Engagement,
    StageInfo,
    StageMove,
)

router = APIRouter(prefix="/api/v1", tags=["pipeline"])

STAGES: list[tuple[str, str, str]] = [
    ("enquiry", "Enquiry", "sales"),
    ("qualified", "Qualified", "sales"),
    ("consultation", "Discovery call", "sales"),
    ("proposal", "Proposal", "sales"),
    ("agreed", "Agreement signed", "buying"),
    ("searching", "Searching", "buying"),
    ("due_diligence", "Due diligence", "buying"),
    ("purchasing", "Purchasing", "buying"),
    ("settled", "Settled", "buying"),
    ("aftercare", "Aftercare", "after"),
    ("closed", "Closed", "closed"),
]
KEYS = [k for k, _, _ in STAGES]


@router.get("/pipeline/stages", response_model=list[StageInfo])
def stages() -> list[StageInfo]:
    return [StageInfo(key=k, label=label, group=g) for k, label, g in STAGES]


@router.post("/engagements/{engagement_id}/stage", response_model=Engagement)
def move_stage(engagement_id: UUID, body: StageMove, request: Request, conn: Conn) -> Engagement:
    current = _read(conn, engagement_id)
    if body.stage not in KEYS:
        raise HTTPException(status_code=422, detail=f"Unknown stage {body.stage!r}")
    if body.stage != "closed" and body.reason:
        raise HTTPException(status_code=422, detail="A reason is only for closing an engagement")
    if body.stage == "closed" and not (body.reason or "").strip():
        raise HTTPException(status_code=422, detail="Say why it is closed (for example did not proceed, and why)")
    if body.stage == current.stage:
        raise HTTPException(status_code=409, detail=f"It is already at {body.stage}")
    conn.execute(
        text(
            "UPDATE engagements SET stage = :s, stage_changed_at = now(), "
            "closed_reason = CASE WHEN :s = 'closed' THEN :r ELSE NULL END WHERE id = :id"
        ),
        {"s": body.stage, "r": (body.reason or "").strip() or None, "id": engagement_id},
    )
    _log_change(conn, request.app.state.settings.agency_id, "engagement", engagement_id, "stage", body.stage, current.stage)
    if body.reason:
        _log_entered_by_hand(conn, request.app.state.settings.agency_id, "engagement", engagement_id, {"closed_reason": body.reason.strip()})
    return _read(conn, engagement_id)


@router.get("/engagements/{engagement_id}/stage-history", response_model=list[ChangeLogEntry])
def stage_history(engagement_id: UUID, conn: Conn) -> list[ChangeLogEntry]:
    _read(conn, engagement_id)
    rows = conn.execute(
        text(
            "SELECT entity, entity_id, field, new_value, earlier_value, source, changed_by, changed_at FROM change_log "
            "WHERE entity = 'engagement' AND entity_id = :id AND field = 'stage' ORDER BY id"
        ),
        {"id": engagement_id},
    ).mappings()
    return [ChangeLogEntry(**r) for r in rows]


@router.get("/pipeline", response_model=Board)
def board(conn: Conn) -> Board:
    rows: list[dict[str, Any]] = [
        dict(r)
        for r in conn.execute(
            text(
                "SELECT e.id, e.stage, h.name AS household_name, b.budget_aud, "
                "(current_date - e.stage_changed_at::date) AS days_in_stage, "
                "COALESCE((SELECT array_agg(p.name ORDER BY p.created_at, p.id) FROM engagement_clients ec "
                "          JOIN persons p ON p.id = ec.person_id WHERE ec.engagement_id = e.id), '{}') AS client_names "
                "FROM engagements e JOIN households h ON h.id = e.household_id "
                "LEFT JOIN buyer_briefs b ON b.engagement_id = e.id ORDER BY e.stage_changed_at, e.id"
            )
        ).mappings()
    ]
    columns = [
        BoardColumn(stage=k, label=label, group=g, engagements=[BoardCard(**r) for r in rows if r["stage"] == k])
        for k, label, g in STAGES
    ]
    return Board(columns=columns)
