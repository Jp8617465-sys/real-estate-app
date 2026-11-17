"""Tasks with an owner and a due date, and a dated timeline of everything that happened on an
engagement: its stage moves, edits, tasks, properties and calls."""
import json
from typing import Any
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import Connection, text

from buyers_desk.engagements import Conn, _read
from buyers_desk.intake.fields import FIELDS
from buyers_desk.paging import PageDep, paginate
from buyers_desk.schemas import NewTask, TaskPatch, TaskSummary, TaskView, TimelineEvent

router = APIRouter(prefix="/api/v1", tags=["tasks"])

_TASK = (
    "SELECT t.id, t.title, t.owner, t.engagement_id, h.name AS household_name, t.person_id, "
    "CAST(t.due_on AS text) AS due_on, t.due_text, t.done_at, "
    "(t.done_at IS NULL AND t.due_on IS NOT NULL AND t.due_on < current_date) AS overdue, t.created_at "
    "FROM tasks t LEFT JOIN engagements e ON e.id = t.engagement_id LEFT JOIN households h ON h.id = e.household_id"
)


def _one(conn: Connection, task_id: UUID) -> TaskView:
    row = conn.execute(text(_TASK + " WHERE t.id = :id"), {"id": task_id}).mappings().first()  # noqa: S608
    if row is None:
        raise HTTPException(status_code=404, detail="No such task")
    return TaskView(**row)


@router.post("/tasks", status_code=201, response_model=TaskView)
def create_task(body: NewTask, request: Request, conn: Conn) -> TaskView:
    if body.engagement_id:
        _read(conn, body.engagement_id)
    if body.person_id and conn.execute(text("SELECT 1 FROM persons WHERE id = :id"), {"id": body.person_id}).first() is None:
        raise HTTPException(status_code=404, detail="No such person")
    task_id = conn.execute(
        text("INSERT INTO tasks (agency_id, engagement_id, person_id, title, owner, due_on) VALUES (:a, :e, :p, :t, :o, :d) RETURNING id"),
        {"a": request.app.state.settings.agency_id, "e": body.engagement_id, "p": body.person_id, "t": body.title.strip(), "o": body.owner.strip() or "Agent", "d": body.due_on},
    ).scalar_one()
    return _one(conn, task_id)


@router.get("/tasks", response_model=list[TaskView])
def list_tasks(conn: Conn, response: Response, page: PageDep, engagement_id: UUID | None = None, person_id: UUID | None = None, state: str = "all", owner: str | None = None) -> list[TaskView]:
    rows = conn.execute(
        text(
            _TASK + " WHERE (CAST(:e AS uuid) IS NULL OR t.engagement_id = :e) AND (CAST(:p AS uuid) IS NULL OR t.person_id = :p) "  # noqa: S608
            "AND (CAST(:o AS text) IS NULL OR t.owner = :o) "
            "AND (:s = 'all' OR (:s = 'open' AND t.done_at IS NULL) OR (:s = 'done' AND t.done_at IS NOT NULL)) "
            "ORDER BY (t.done_at IS NOT NULL), t.due_on NULLS LAST, t.created_at, t.id LIMIT 5000"
        ),
        {"e": engagement_id, "p": person_id, "o": owner, "s": state},
    ).mappings()
    return [TaskView(**r) for r in paginate(list(rows), response, page)]


@router.get("/tasks/summary", response_model=TaskSummary)
def task_summary(conn: Conn) -> TaskSummary:
    row = conn.execute(
        text(
            "SELECT count(*) FILTER (WHERE done_at IS NULL) AS open, "
            "count(*) FILTER (WHERE done_at IS NULL AND due_on < current_date) AS overdue, "
            "count(*) FILTER (WHERE done_at IS NULL AND due_on = current_date) AS due_today FROM tasks"
        )
    ).mappings().one()
    return TaskSummary(**row)


@router.patch("/tasks/{task_id}", response_model=TaskView)
def edit_task(task_id: UUID, body: TaskPatch, conn: Conn) -> TaskView:
    _one(conn, task_id)
    for field, value in body.model_dump(exclude_unset=True).items():
        if value is None and field != "due_on":
            continue
        conn.execute(text(f"UPDATE tasks SET {field} = :v WHERE id = :id"), {"v": value, "id": task_id})  # noqa: S608
    return _one(conn, task_id)


@router.post("/tasks/{task_id}/done", response_model=TaskView)
def finish_task(task_id: UUID, conn: Conn) -> TaskView:
    _one(conn, task_id)
    conn.execute(text("UPDATE tasks SET done_at = coalesce(done_at, now()) WHERE id = :id"), {"id": task_id})
    return _one(conn, task_id)


@router.post("/tasks/{task_id}/reopen", response_model=TaskView)
def reopen_task(task_id: UUID, conn: Conn) -> TaskView:
    _one(conn, task_id)
    conn.execute(text("UPDATE tasks SET done_at = NULL WHERE id = :id"), {"id": task_id})
    return _one(conn, task_id)


@router.post("/engagements/{engagement_id}/tasks/from-actions", status_code=201, response_model=list[TaskView])
def tasks_from_next_actions(engagement_id: UUID, request: Request, conn: Conn) -> list[TaskView]:
    """Turn the next actions accepted from calls into tasks, once each."""
    _read(conn, engagement_id)
    actions = conn.execute(
        text(
            "SELECT v.id, v.value, v.extra FROM record_values v WHERE v.engagement_id = :e AND v.current AND v.section = 'actions' "
            "AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.source_value_id = v.id) ORDER BY v.created_at, v.id"
        ),
        {"e": engagement_id},
    ).mappings().all()
    created: list[UUID] = []
    for a in actions:
        owners = a["extra"].get("owners") or []
        created.append(
            conn.execute(
                text(
                    "INSERT INTO tasks (agency_id, engagement_id, title, owner, due_text, source_value_id) "
                    "VALUES (:ag, :e, :t, :o, :d, :v) RETURNING id"
                ),
                {"ag": request.app.state.settings.agency_id, "e": engagement_id, "t": a["value"], "o": " and ".join(owners) or "Agent",
                 "d": a["extra"].get("due"), "v": a["id"]},
            ).scalar_one()
        )
    return [_one(conn, t) for t in created]


# ---- Timeline -----------------------------------------------------------------------------------------------------------------


def _source_label(source: dict[str, Any]) -> str:
    if source.get("kind") == "entered_by_hand":
        return "Entered by hand"
    return str(source.get("label") or source.get("transcript") or source.get("kind") or "")


def _title(field: str, new: Any, earlier: Any) -> str:
    if field == "stage":
        return f"Stage moved: {earlier} → {new}"
    if field == "closed_reason":
        return f"Closed: {new}"
    if field.startswith("property:"):
        _, address, attr = field.split(":", 2)
        return f"{address}: {attr} {new}"
    subject = None
    key = field
    if ":" in field:
        key, subject = field.split(":", 1)
    label = FIELDS[key].label if key in FIELDS else key.replace("_", " ").capitalize()
    if subject:
        label = f"{label} ({subject})"
    if new is None:
        return f"{label} removed: {earlier}"
    shown = json.dumps(new) if isinstance(new, (dict, list)) else str(new)
    return f"{label}: {shown}" + (f" (was {earlier})" if earlier is not None else "")


@router.get("/engagements/{engagement_id}/timeline", response_model=list[TimelineEvent])
def timeline(engagement_id: UUID, conn: Conn) -> list[TimelineEvent]:
    engagement = _read(conn, engagement_id)
    events: list[tuple[Any, int, TimelineEvent]] = []
    events.append((engagement.created_at, 0, TimelineEvent(at=engagement.created_at, kind="engagement", title=f"Opportunity opened for {engagement.household_name}", source="")))
    for r in conn.execute(
        text(
            "SELECT c.entity, c.field, c.new_value, c.earlier_value, c.source, c.changed_at FROM change_log c, engagements e "
            "WHERE e.id = :e AND ((c.entity IN ('brief', 'profile', 'intake', 'properties', 'actions', 'engagement') AND c.entity_id = e.id) "
            "OR (c.entity = 'household' AND c.entity_id = e.household_id)) ORDER BY c.id"
        ),
        {"e": engagement_id},
    ).mappings():
        events.append((r["changed_at"], 1, TimelineEvent(at=r["changed_at"], kind=r["entity"], title=_title(r["field"], r["new_value"], r["earlier_value"]), source=_source_label(r["source"]))))
    for t in conn.execute(text("SELECT title, created_at, done_at FROM tasks WHERE engagement_id = :e"), {"e": engagement_id}).mappings():
        events.append((t["created_at"], 1, TimelineEvent(at=t["created_at"], kind="task", title=f"Task added: {t['title']}", source="")))
        if t["done_at"]:
            events.append((t["done_at"], 1, TimelineEvent(at=t["done_at"], kind="task", title=f"Task done: {t['title']}", source="")))
    for i in conn.execute(text("SELECT filename, created_at, applied_at FROM intakes WHERE engagement_id = :e"), {"e": engagement_id}).mappings():
        events.append((i["created_at"], 1, TimelineEvent(at=i["created_at"], kind="call", title=f"Call uploaded: {i['filename']}", source="")))
        if i["applied_at"]:
            events.append((i["applied_at"], 1, TimelineEvent(at=i["applied_at"], kind="call", title=f"Call reviewed: {i['filename']}", source="")))
    for c in conn.execute(text("SELECT direction, channel, subject, occurred_at FROM communications WHERE engagement_id = :e"), {"e": engagement_id}).mappings():
        what = {"email": "Email", "call": "Call", "sms": "Text", "note": "Note"}[c["channel"]]
        verb = "" if c["channel"] == "note" else (" received" if c["direction"] == "in" else " sent")
        events.append((c["occurred_at"], 1, TimelineEvent(at=c["occurred_at"], kind="communication", title=f"{what}{verb}: {c['subject']}", source="")))
    events.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [e for _, _, e in events]
