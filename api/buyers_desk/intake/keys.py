"""James's approved answer keys (testdata/intake-consultations/expected/*.md), parsed.

A key says what a correct, cautious extraction suggests. Here it becomes data: key items (with
the quotes that support them), the quotes that must NOT lead to a suggestion, and the speakers'
roles. The scored run measures an extractor against it; replaying a key gives a no-cost extractor.
"""
import re
from dataclasses import dataclass
from dataclasses import field as dc_field
from pathlib import Path
from typing import Any

from buyers_desk.intake import transcript as transcript_parser

TESTDATA = Path(__file__).resolve().parents[3] / "testdata" / "intake-consultations"

# Label prefix in the key's tables -> field id. None means the key records it but the field list does not.
_LABELS: list[tuple[str, str | None]] = [
    ("household members", None), ("involved relative", None), ("previous ownership", "housing"),
    ("who has the final say", "finalSay"), ("pets", "pets"), ("own or rent", "housing"),
    ("relocation and current home", "housing"), ("work", "work"), ("children", "children"),
    ("family help", "familyHelp"), ("family", "children"), ("visiting family", "notes"),
    ("purpose", "purpose"), ("budget target", "budgetTarget"), ("budget ceiling", "budgetCeiling"),
    ("pre-approval", "preApproval"), ("deposit scheme", "depositScheme"), ("deposit", "deposit"),
    ("first home", "firstHome"), ("must sell first", "mustSellFirst"), ("area", "areas"),
    ("property type", "propertyType"), ("bedrooms", "bedrooms"), ("bathrooms", "bathrooms"),
    ("parking", "parking"), ("land", "landSize"), ("must-have", "mustHaves"),
    ("nice-to-have", "niceToHaves"), ("deal-breaker", "dealBreakers"), ("aircraft noise", "dealBreakers"),
    ("renovation", "renovation"), ("timeline", "timeline"), ("brief notes", "notes"),
    ("new or established", "newOrEstablished"), ("strata", "strata"), ("professionals", "professionals"),
    ("broker's price guidance", "brokerGuidance"), ("broker's guidance", "brokerGuidance"),
    ("yield vs growth", "investor"), ("buying entity", "investor"), ("tenanted", "investor"),
    ("character overlay", "floodTolerance"), ("accessibility", "accessibility"),
    ("referral source", "referral"), ("service wanted", "service"),
]
_SECTION_OF = {"Profile": "profile", "Brief": "brief", "Engagement intake": "intake"}


@dataclass
class KeyItem:
    field: str
    label: str
    value: str
    basis: str
    quotes: list[tuple[str, str]]  # (speaker label, text)
    key: bool  # a key item: budget figures, deal-breakers, pre-approval, next actions
    scored: bool = True
    tokens: list[str] = dc_field(default_factory=list)
    subject: str | None = None
    owners: list[str] = dc_field(default_factory=list)
    due: str | None = None
    outcome: str | None = None


@dataclass
class AnswerKey:
    number: str
    name: str
    text: str
    kind: str
    turns: list[dict[str, object]]
    roles: dict[str, str]  # speaker label -> agent | household | other
    items: list[KeyItem]
    must_not: list[tuple[str, str]]  # (speaker label, quote)
    confirm: list[tuple[str, str]]
    conflicts: list[dict[str, Any]]


def _cells(line: str) -> list[str]:
    s = line.strip()
    s = s[1:] if s.startswith("|") else s
    s = s[:-1] if s.endswith("|") else s
    return [c.strip().replace("\\|", "|") for c in re.split(r"(?<!\\)\|", s)]


def _tables(md: str) -> dict[str, list[list[str]]]:
    tables: dict[str, list[list[str]]] = {}
    section = ""
    for line in md.split("\n"):
        if line.startswith("## "):
            section = line[3:].strip()
        elif line.startswith("|") and not re.match(r"^\|\s*-", line):
            tables.setdefault(section, []).append(_cells(line))
    return {k: v[1:] for k, v in tables.items() if v}  # drop each header row


def _quotes(cell: str) -> list[str]:
    return re.findall(r"`([^`]+)`", cell)


def _locate(turns: list[dict[str, object]], quote: str, prefer: list[str]) -> str:
    hits = [str(t["speaker"]) for t in turns if quote in str(t["text"])]
    for label in hits:
        if any(label == p or label.startswith(p) or p.startswith(label) for p in prefer):
            return label
    if not hits:
        raise ValueError(f"quote not in transcript: {quote!r}")
    return hits[0]


def _speaker_hints(cell: str) -> list[str]:
    return [part.split(" — ")[0].strip() for part in cell.split(";")]


def _field_of(label: str) -> str | None:
    low = label.lower()
    for prefix, fid in _LABELS:
        if low.startswith(prefix):
            return fid
    return None


def _role(role_text: str) -> str:
    low = role_text.lower()
    if low.startswith("buyers agent") or "agent running" in low or low.startswith("author"):
        return "agent"
    if low.startswith("buyer ") or low.startswith("buyer("):
        return "household"
    return "other"


def _distinguish(items: list[KeyItem]) -> None:
    """Items of one field whose quotes are all shared with a sibling (four areas named in one
    breath) can only be told apart by name. Everything else is matched by its quote alone."""
    for item in items:
        mine = {q for _, q in item.quotes}
        shares = any(o is not item and o.field == item.field and mine <= {q for _, q in o.quotes} for o in items)
        first = re.split(r"[/(]", item.tokens[0])[0].strip().lower() if item.tokens else ""
        item.tokens = [first] if shares and first else []


def parse_key(number: str, directory: Path = TESTDATA) -> AnswerKey:
    source = next(directory.glob(f"{number}-*"))
    notes = number == "05"
    kind, turns = transcript_parser.parse(source.name, source.read_text(encoding="utf-8"), notes=notes)
    md = (directory / "expected" / f"{number}-expected.md").read_text(encoding="utf-8")
    tables = _tables(md)
    labels = list(dict.fromkeys(str(t["speaker"]) for t in turns))
    roles = {label: "other" for label in labels}
    people: dict[str, str] = {}  # first name -> speaker label
    for label, person, role in tables.get("Speakers", []):
        match = next((x for x in labels if x == label), None)
        if match is None and kind == "notes":
            continue
        if match:
            roles[match] = _role(role)
            people[person.split()[0].strip('("').lower()] = match
            people[label.split()[0].lower()] = match
    if kind == "notes":
        roles[labels[0]] = "agent"

    def label_for(name: str) -> str | None:
        first = re.sub(r"[^a-z ]", "", name.lower()).split()
        return people.get(first[0]) if first else None

    items: list[KeyItem] = []
    for section_name, section in _SECTION_OF.items():
        for row in tables.get(section_name, []):
            if len(row) < 6:
                continue
            fid = _field_of(row[0])
            qs = _quotes(row[2])
            if fid is None or not qs:
                continue
            hints = _speaker_hints(row[3])
            located = [(_locate(turns, q, hints), q) for q in qs]
            tail = row[0].split(":", 1)[1].strip() if ":" in row[0] else ""
            subject = None
            work = re.match(r"Work \((\w+)\)", row[0])
            if work:
                subject = label_for(work.group(1))
            items.append(
                KeyItem(
                    field=fid, label=row[0], value=row[1], basis="inferred" if "inferred" in row[4].lower() else "stated",
                    quotes=located, key=row[5].strip().lower().startswith("yes"), scored=fid != "notes",
                    tokens=[tail] if tail else [],
                    subject=subject,
                )
            )
    _distinguish(items)
    for row in tables.get("Properties mentioned", []):
        qs = _quotes(row[4])
        if qs:
            located = [(_locate(turns, q, _speaker_hints(row[5])), q) for q in qs]
            items.append(KeyItem("properties", "Property: " + row[1], row[0], "stated", located, False, outcome=row[2]))
    for row in tables.get("Next actions", []):
        qs = _quotes(row[3])
        if qs:
            located = [(_locate(turns, q, _speaker_hints(row[4])), q) for q in qs]
            owners = []
            for owner in re.split(r",| and | with ", row[0]):
                lab = label_for(owner.strip())
                if lab and lab not in owners:
                    owners.append(lab)
            items.append(KeyItem("nextActions", "Next action: " + row[1][:50], row[1], "stated", located, True, owners=owners, due=row[2]))
    must_not: list[tuple[str, str]] = []
    for row in tables.get("Must NOT be suggested", []):
        for q in _quotes(row[1]):
            must_not.append((_locate(turns, q, []), q))
    confirm: list[tuple[str, str]] = []
    for row in tables.get("Confirm with client", []):
        for q in _quotes(row[1]):
            confirm.append((_locate(turns, q, []), q))
    conflicts: list[dict[str, Any]] = []
    for row in tables.get("Conflicts and disagreements", []):
        conflicts.append({
            "topic": row[0], "handling": row[3],
            "one": [(_locate(turns, q, []), q) for q in _quotes(row[1])],
            "other": [(_locate(turns, q, []), q) for q in _quotes(row[2])],
        })
    return AnswerKey(number, source.name, source.read_text(encoding="utf-8"), kind, turns, roles, items, must_not, confirm, conflicts)


def load_keys(directory: Path = TESTDATA) -> list[AnswerKey]:
    numbers = sorted(p.name[:2] for p in (directory / "expected").glob("[0-9][0-9]-expected.md"))
    return [parse_key(n, directory) for n in numbers]
