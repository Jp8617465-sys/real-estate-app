"""Feedback captured during a trial: who, which part of the app, and what they noticed."""
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Request, Response
from pydantic import BaseModel, field_validator
from sqlalchemy import text

from buyers_desk.engagements import Conn
from buyers_desk.paging import PageDep, paginate

router = APIRouter(prefix="/api/v1", tags=["feedback"])


class NewFeedback(BaseModel):
    author: str = ""
    area: str = ""
    note: str

    @field_validator("note")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("a note cannot be empty")
        return v.strip()


class FeedbackView(BaseModel):
    id: UUID
    author: str
    area: str
    note: str
    created_at: datetime


@router.post("/feedback", status_code=201, response_model=FeedbackView)
def add_feedback(body: NewFeedback, request: Request, conn: Conn) -> FeedbackView:
    row = conn.execute(
        text("INSERT INTO feedback_notes (agency_id, author, area, note) VALUES (:a, :au, :ar, :n) RETURNING id, author, area, note, created_at"),
        {"a": request.app.state.settings.agency_id, "au": body.author.strip(), "ar": body.area.strip(), "n": body.note},
    ).mappings().one()
    return FeedbackView(**row)


@router.get("/feedback", response_model=list[FeedbackView])
def list_feedback(conn: Conn, response: Response, page: PageDep) -> list[FeedbackView]:
    rows = conn.execute(text("SELECT id, author, area, note, created_at FROM feedback_notes ORDER BY created_at DESC, id")).mappings().all()
    return [FeedbackView(**r) for r in paginate(list(rows), response, page)]
