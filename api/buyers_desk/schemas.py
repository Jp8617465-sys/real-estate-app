"""The documented product API: request and response shapes for buying opportunities."""
from datetime import datetime
from typing import Any, Literal
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
    stage_changed_at: datetime
    closed_reason: str | None


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


# ---- Discovery-call intake -----------------------------------------------------------------------


class NewIntake(BaseModel):
    filename: str = Field(min_length=1)
    text: str = Field(min_length=1)
    notes: bool = False


class Turn(BaseModel):
    n: int
    time: str
    speaker: str
    text: str


class SpeakerMatch(BaseModel):
    kind: str
    name: str
    role: str
    person_id: str | None
    is_new: bool
    guessed: bool


class SpeakerView(BaseModel):
    label: str
    turn_count: int
    match: SpeakerMatch | None
    unlocks: dict[str, str]
    warning: str | None


class SpeakerMatchRequest(BaseModel):
    label: str
    kind: str | None
    name: str = ""
    role: str = ""
    person_id: str | None = None
    is_new: bool = False


class QuoteView(BaseModel):
    speaker: str
    speaker_name: str
    text: str
    cue: int
    time: str


class EarlierValue(BaseModel):
    value: str
    quotes: list[QuoteView]


class DisagreementView(BaseModel):
    person: str
    value: str
    quote: QuoteView


class ConflictView(BaseModel):
    type: str
    earlier: EarlierValue | None = None
    views: list[DisagreementView] | None = None


class Reason(BaseModel):
    code: str
    tone: str
    text: str


class OnRecord(BaseModel):
    value: str
    source: str | None


class DecisionView(BaseModel):
    status: str
    value: str | None


class QueueItem(BaseModel):
    id: str
    field: str
    field_label: str
    item: str
    section: str
    group: str
    value: str
    basis: str
    subject: str | None
    quotes: list[QuoteView]
    conflict: ConflictView | None
    owners: list[str] | None
    owner_names: list[str] | None
    due: str | None
    outcome: str | None
    note: str | None
    bucket: str
    reasons: list[Reason]
    blocked: str | None
    current: OnRecord | None
    decision: DecisionView | None


class DroppedView(BaseModel):
    id: str
    field: str
    value: str
    reason: str


class HistoryEntry(BaseModel):
    value: str
    source: str | None


class RecordEntry(BaseModel):
    field: str
    label: str
    section: str
    subject: str | None
    value: str
    status: str
    basis: str | None
    quotes: list[QuoteView]
    source: str
    owners: list[str] | None
    due: str | None
    outcome: str | None
    history: list[HistoryEntry]


class Summary(BaseModel):
    entries: dict[str, list[RecordEntry]]
    to_discuss: list[RecordEntry]
    not_covered: list[str]
    ask: list[QueueItem]
    rejected: list[QueueItem]
    undecided: list[QueueItem]
    written: int


class Section(BaseModel):
    key: str
    label: str


class LastResult(BaseModel):
    ok: bool
    text: str


class IntakeView(BaseModel):
    id: UUID
    engagement_id: UUID
    stage: str
    source: dict[str, str]
    notice: str
    extractor: str
    extraction_note: str | None
    turns: list[Turn]
    speakers: list[SpeakerView]
    dropped_count: int
    dropped: list[DroppedView]
    queue: list[QueueItem]
    sections: list[Section]
    summary: Summary | None
    review_seconds: int | None
    last: LastResult
    created_at: datetime


class IntakeSummary(BaseModel):
    id: UUID
    filename: str
    stage: str
    created_at: datetime


class Decision(BaseModel):
    type: str
    id: str | None = None
    value: str | None = None


class RecordValue(BaseModel):
    field: str
    label: str
    section: str
    subject: str | None
    value: str
    status: str
    basis: str | None
    source: str
    quotes: list[QuoteView]
    earlier: list[HistoryEntry]
    recorded_at: datetime


class EngagementRecord(BaseModel):
    engagement_id: UUID
    sections: list[Section]
    values: list[RecordValue]
    professionals: list["ProfessionalView"]


class ProfessionalView(BaseModel):
    person_id: UUID
    name: str
    role: str


# ---- Clients and households (slice 1) -------------------------------------------------------------


class NewPerson(BaseModel):
    name: str = Field(min_length=1)
    email: str | None = Field(default=None, min_length=1)
    mobile: str | None = Field(default=None, min_length=1)
    confirm_duplicate: bool = False


class PersonEdit(BaseModel):
    name: str | None = Field(default=None, min_length=1)
    email: str | None = Field(default=None, min_length=1)
    mobile: str | None = Field(default=None, min_length=1)
    confirm_duplicate: bool = False


class PersonSummary(BaseModel):
    id: UUID
    name: str
    email: str | None
    mobile: str | None
    household_names: list[str]


class HouseholdMembership(BaseModel):
    household_id: UUID
    name: str
    started_on: str
    ended_on: str | None


class RelationshipView(BaseModel):
    id: UUID
    other_person_id: UUID
    other_name: str
    kind: str
    note: str | None


class PersonEngagement(BaseModel):
    id: UUID
    household_name: str
    stage: str


class PersonDetail(BaseModel):
    id: UUID
    name: str
    email: str | None
    mobile: str | None
    households: list[HouseholdMembership]
    relationships: list[RelationshipView]
    engagements: list[PersonEngagement]


class NewHousehold(BaseModel):
    name: str = Field(min_length=1)
    member_ids: list[UUID] = Field(default_factory=list)


class Member(BaseModel):
    person_id: UUID
    name: str
    started_on: str
    ended_on: str | None


class HouseholdView(BaseModel):
    id: UUID
    name: str
    members: list[Member]
    former_members: list[Member]
    engagements: list[PersonEngagement]


class HouseholdSummary(BaseModel):
    id: UUID
    name: str
    member_names: list[str]


class AddMember(BaseModel):
    person_id: UUID


class EndMembership(BaseModel):
    ended_on: str | None = None


class NewRelationship(BaseModel):
    other_person_id: UUID
    kind: Literal["partner", "parent", "child", "sibling", "other"]
    note: str | None = None


class HouseholdOpportunity(BaseModel):
    budget_aud: int | None = Field(default=None, gt=0)


# ---- Pipeline (slice 2) -----------------------------------------------------------------------------------


class StageInfo(BaseModel):
    key: str
    label: str
    group: str


class StageMove(BaseModel):
    stage: str
    reason: str | None = None


class BoardCard(BaseModel):
    id: UUID
    stage: str
    household_name: str
    client_names: list[str]
    budget_aud: int | None
    days_in_stage: int


class BoardColumn(BaseModel):
    stage: str
    label: str
    group: str
    engagements: list[BoardCard]


class Board(BaseModel):
    columns: list[BoardColumn]


# ---- Brief editor (slice 3) ---------------------------------------------------------------------------------


class NewBriefValue(BaseModel):
    value: str
    subject: str | None = None


class BriefValue(BaseModel):
    id: UUID | None
    value: str
    subject: str | None
    status: str
    basis: str | None
    source: str
    history: list[HistoryEntry]
    recorded_at: datetime | None


class BriefField(BaseModel):
    id: str
    label: str
    item: str
    kind: str
    group: str
    per_person: bool
    values: list[BriefValue]


class BriefSection(BaseModel):
    key: str
    label: str
    fields: list[BriefField]


class BriefView(BaseModel):
    engagement_id: UUID
    sections: list[BriefSection]
    not_covered: list[str]


# ---- Properties and shortlist (slice 4) ------------------------------------------------------------------------

PropertyStatus = Literal["considering", "shortlisted", "inspecting", "held", "offered", "purchased", "passed", "missed"]


class NewProperty(BaseModel):
    address_line: str = Field(min_length=1)
    suburb: str | None = None
    state: str | None = None
    postcode: str | None = None
    property_type: str | None = None
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    parking: int | None = Field(default=None, ge=0)
    land_m2: int | None = Field(default=None, ge=0)
    price_guide_low: int | None = Field(default=None, ge=0)
    price_guide_high: int | None = Field(default=None, ge=0)
    listing_url: str | None = None
    notes: str | None = None
    confirm_duplicate: bool = False


class PropertyPatch(BaseModel):
    address_line: str | None = Field(default=None, min_length=1)
    suburb: str | None = None
    state: str | None = None
    postcode: str | None = None
    property_type: str | None = None
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: int | None = Field(default=None, ge=0)
    parking: int | None = Field(default=None, ge=0)
    land_m2: int | None = Field(default=None, ge=0)
    price_guide_low: int | None = Field(default=None, ge=0)
    price_guide_high: int | None = Field(default=None, ge=0)
    listing_url: str | None = None
    notes: str | None = None


class Property(BaseModel):
    id: UUID
    address_line: str
    suburb: str | None
    state: str | None
    postcode: str | None
    property_type: str | None
    bedrooms: int | None
    bathrooms: int | None
    parking: int | None
    land_m2: int | None
    price_guide_low: int | None
    price_guide_high: int | None
    listing_url: str | None
    notes: str | None
    source: str


class AttachProperty(BaseModel):
    property_id: UUID
    status: PropertyStatus = "considering"


class EngagementPropertyPatch(BaseModel):
    status: PropertyStatus | None = None
    assessment: str | None = None
    reasons: str | None = None


class NewCheck(BaseModel):
    criterion: str = Field(min_length=1)
    result: Literal["meets", "partly", "fails", "unknown"]
    note: str | None = None


class CheckView(BaseModel):
    id: UUID
    criterion: str
    result: str
    note: str | None


class Fit(BaseModel):
    meets: int
    partly: int
    fails: int
    unknown: int


class EngagementProperty(BaseModel):
    id: UUID
    engagement_id: UUID
    property: Property
    status: str
    assessment: str | None
    reasons: str | None
    checks: list[CheckView]
    fit: Fit
    budget_fit: str


class ShortlistView(BaseModel):
    properties: list[EngagementProperty]
    suggested_criteria: list[str]
