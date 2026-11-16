"""The documented product API: request and response shapes for buying opportunities."""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class NewClient(BaseModel):
    name: str = Field(min_length=1)
    email: str | None = Field(default=None, min_length=1)
    mobile: str | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def needs_a_way_to_reach_them(self) -> "NewClient":
        if self.email is None and self.mobile is None:
            raise ValueError("a client needs an email or a mobile")
        return self


class NewBuyingOpportunity(BaseModel):
    household_name: str = Field(min_length=1)
    client: NewClient
    budget_aud: int | None = Field(default=None, gt=0)


class Client(BaseModel):
    id: UUID
    name: str
    email: str | None
    mobile: str | None


class EngagementSummary(BaseModel):
    id: UUID
    service_line: str
    stage: str
    household_name: str
    client_names: list[str]
    budget_aud: int | None
    created_at: datetime


class Engagement(EngagementSummary):
    clients: list[Client]


class ChangeLogEntry(BaseModel):
    entity: str
    entity_id: UUID
    field: str
    new_value: Any
    earlier_value: Any
    source: dict[str, Any]
    changed_by: str
    changed_at: datetime
