"""What the ports return. Every result says whether it is synthetic."""
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel


class IntegrationInfo(BaseModel):
    port: str
    adapter: str
    synthetic: bool
    live: bool
    description: str


class Fact(BaseModel):
    value: Any
    observed_at: date | None  # when the source last observed or updated it
    retrieved_at: datetime  # when we fetched it: never the same thing
    source: str
    stale: bool


class PropertyRecord(BaseModel):
    address_line: str
    suburb: str
    state: str
    postcode: str
    facts: dict[str, Fact]
    missing: list[str]
    stale: list[str]
    synthetic: bool
    terms: str


class GeoResult(BaseModel):
    lat: float
    lng: float
    precision: Literal["suburb", "address"]
    source: str
    synthetic: bool


class DriveTime(BaseModel):
    from_place: str
    to_place: str
    minutes: int | None
    source: str
    synthetic: bool


class Slot(BaseModel):
    start: datetime
    end: datetime


class Invite(BaseModel):
    uid: str
    ics: str
    slot: Slot
    attendees: list[str]
    synthetic: bool


class CheckResult(BaseModel):
    kind: str
    status: Literal["passed", "needs_review", "failed"]
    provider: str
    reference: str
    evidence: list[str]
    synthetic: bool
