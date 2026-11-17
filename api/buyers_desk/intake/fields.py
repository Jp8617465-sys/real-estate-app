"""The agreed field list for suggestions (decided on the transcript-intake decision ticket).

`support` says whose words can carry a field:
  household                  a speaker matched to a household member must be quoted
  household-or-professional  a household member or someone else (their broker) may be quoted
  owner                      a next action: someone who owes it must be quoted committing to it
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Field:
    id: str
    label: str
    item: str
    section: str  # profile | brief | intake | properties | actions
    group: str
    kind: str  # one | many
    support: str
    key: bool = False
    per_person: bool = False  # a "one" field kept once per person (work), named in `subject`
    investor_only: bool = False
    partly_field: str | None = None
    partly_pattern: str | None = None
    partly_text: str | None = None


def _f(
    id: str, label: str, item: str, section: str, group: str, kind: str, support: str, **extra: object
) -> tuple[str, Field]:
    return id, Field(id, label, item, section, group, kind, support, **extra)  # type: ignore[arg-type]


FIELDS: dict[str, Field] = dict(
    [
        _f("finalSay", "Who has the final say", "Final say", "profile", "People", "one", "household"),
        _f("housing", "Lives now", "Lives now", "profile", "Circumstances", "one", "household"),
        _f("work", "Work", "Work", "profile", "Circumstances", "one", "household", per_person=True),
        _f("children", "Children and schooling", "Children", "profile", "Circumstances", "one", "household"),
        _f("pets", "Pets", "Pets", "profile", "Circumstances", "one", "household"),
        _f("accessibility", "Accessibility", "Accessibility", "profile", "Circumstances", "one", "household"),
        _f("professionals", "Professionals", "Professional", "profile", "Professionals", "many", "household-or-professional"),
        _f("purpose", "Purpose", "Purpose", "brief", "Purpose and money", "one", "household"),
        _f("firstHome", "First home buyer", "First home buyer", "brief", "Purpose and money", "one", "household"),
        _f("budgetTarget", "Budget target", "Budget target", "brief", "Purpose and money", "one", "household", key=True),
        _f("budgetCeiling", "Budget ceiling", "Budget ceiling", "brief", "Purpose and money", "one", "household", key=True),
        _f("brokerGuidance", "Broker's price guidance", "Broker's price guidance", "brief", "Purpose and money", "one", "household-or-professional"),
        _f("preApproval", "Pre-approval (status, amount, lender, expiry)", "Pre-approval", "brief", "Purpose and money", "one", "household-or-professional", key=True),
        _f("deposit", "Deposit and funds", "Deposit and funds", "brief", "Purpose and money", "one", "household"),
        _f("depositScheme", "Deposit scheme", "Deposit scheme", "brief", "Purpose and money", "one", "household-or-professional"),
        _f("familyHelp", "Family help", "Family help", "brief", "Purpose and money", "one", "household"),
        _f("mustSellFirst", "Must sell first", "Must sell first", "brief", "Purpose and money", "one", "household"),
        _f("areas", "Areas", "Area", "brief", "Where", "many", "household"),
        _f("propertyType", "Property type", "Property type", "brief", "What", "one", "household"),
        _f("bedrooms", "Bedrooms", "Bedrooms", "brief", "What", "one", "household"),
        _f("bathrooms", "Bathrooms", "Bathrooms", "brief", "What", "one", "household"),
        _f("parking", "Parking", "Parking", "brief", "What", "one", "household"),
        _f("landSize", "Land and size", "Land and size", "brief", "What", "one", "household"),
        _f("mustHaves", "Must-haves", "Must-have", "brief", "Must-haves", "many", "household"),
        _f("dealBreakers", "Deal-breakers", "Deal-breaker", "brief", "Deal-breakers", "many", "household", key=True),
        _f("niceToHaves", "Nice-to-haves", "Nice-to-have", "brief", "Nice-to-haves", "many", "household"),
        _f("newOrEstablished", "New or established", "New or established", "brief", "Condition and risk", "one", "household"),
        _f("strata", "Strata acceptable", "Strata acceptable", "brief", "Condition and risk", "one", "household"),
        _f("renovation", "Renovation appetite", "Renovation appetite", "brief", "Condition and risk", "one", "household"),
        _f(
            "floodTolerance", "Flood or overlay tolerance", "Flood or overlay tolerance", "brief",
            "Condition and risk", "one", "household",
            partly_field="dealBreakers", partly_pattern="flood",
            partly_text="overlay-only not discussed (flooding itself is a deal-breaker)",
        ),
        _f("timeline", "Timeline", "Timeline", "brief", "Timing", "one", "household"),
        _f("investor", "Investor-only: entity, yield or growth, tenanted", "Investor-only", "brief", "Investor", "one", "household", investor_only=True),
        _f("notes", "Brief notes (not scored)", "Brief note", "brief", "Notes", "many", "household"),
        _f("referral", "Referral source", "Referral source", "intake", "Engagement intake", "one", "household-or-professional"),
        _f("service", "Service wanted", "Service wanted", "intake", "Engagement intake", "one", "household"),
        _f("properties", "Properties mentioned", "Property mentioned", "properties", "Properties", "many", "household"),
        _f("nextActions", "Next actions", "Next action", "actions", "Next actions", "many", "owner", key=True),
    ]
)

SECTIONS: list[tuple[str, str]] = [
    ("profile", "Clients and household"),
    ("brief", "Buyer brief"),
    ("intake", "Engagement intake"),
    ("properties", "Properties mentioned"),
    ("actions", "Next actions"),
]
