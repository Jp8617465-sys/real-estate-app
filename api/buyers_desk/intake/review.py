"""The pure core of the intake: the suggestion contract, the quote check, speaker matching and the
review state machine (speakers -> review -> result). No I/O: state in, state out.

Ported from the prototype's reducer (prototypes/transcript-suggestion-review.html), whose rules
James confirmed, with undo, matched professionals and the notes rule added.
"""
import copy
import re
from typing import Any

from buyers_desk.intake.fields import FIELDS, SECTIONS, Field

State = dict[str, Any]
Suggestion = dict[str, Any]

WRITTEN = ("accepted", "edited", "earlier", "discuss")
KINDS = ("agent", "household", "professional", "other")

# ---- Suggestion contract and quote check -------------------------------------------------------


def _quote_sets(s: Suggestion) -> list[list[dict[str, str]]]:
    conflict = s.get("conflict") or {}
    return [
        s.get("quotes") or [],
        (conflict.get("earlier") or {}).get("quotes") or [],
        [v["quote"] for v in conflict.get("views") or []],
    ]


def problem(turns: list[dict[str, Any]], s: Suggestion) -> str | None:
    """Why a suggestion cannot reach review, or None. Every quote must sit inside one turn
    by the claimed speaker."""
    if s.get("field") not in FIELDS:
        return f"“{s.get('fieldLabel') or s.get('field')}” is not on the agreed field list"
    if s.get("basis") not in ("stated", "inferred"):
        return "Not marked stated or inferred"
    if not s.get("quotes"):
        return "No supporting quote"
    for q in [q for group in _quote_sets(s) for q in group]:
        hits = [t for t in turns if q["text"] in t["text"]]
        if not hits:
            return f"Quote not found word for word: “{q['text']}”"
        if not any(t["speaker"] == q["speaker"] for t in hits):
            return f"Quote found, but “{hits[0]['speaker']}” said it, not “{q['speaker']}”"
    return None


def _locate(turns: list[dict[str, Any]], q: dict[str, str]) -> dict[str, Any]:
    turn = next(t for t in turns if t["speaker"] == q["speaker"] and q["text"] in t["text"])
    return {**q, "cue": turn["n"], "time": turn["time"]}


def check_suggestions(
    turns: list[dict[str, Any]], raw: list[Suggestion]
) -> tuple[list[Suggestion], list[Suggestion]]:
    kept: list[Suggestion] = []
    dropped: list[Suggestion] = []
    for s in raw:
        reason = problem(turns, s)
        if reason:
            dropped.append({**s, "reason": reason})
            continue
        c = s.get("conflict")
        located = {**s, "quotes": [_locate(turns, q) for q in s["quotes"]]}
        if c:
            located["conflict"] = {
                **c,
                **(
                    {"earlier": {**c["earlier"], "quotes": [_locate(turns, q) for q in c["earlier"]["quotes"]]}}
                    if c.get("earlier")
                    else {}
                ),
                **(
                    {"views": [{**v, "quote": _locate(turns, v["quote"])} for v in c["views"]]}
                    if c.get("views")
                    else {}
                ),
            }
        kept.append(located)
    return kept, dropped


# ---- Speakers: guesses, what a match unlocks, and the professional-sounding warning ----------

_PROFESSIONAL_TALK = re.compile(
    r"pre-?approv|lender|borrow|serviceab|\bLVR\b|\blodge|\bloan\b|conveyanc|cooling[- ]off|"
    r"stamp duty|\bLMI\b|first home guarantee|settlement|rate options",
    re.I,
)
PROFESSIONAL_WARNING = (
    "This speaker talks about borrowing, lenders and approvals like a professional. If they are "
    "the broker, matching them as a client would turn their limits into the buyers' own requirements."
)


def sounds_like_a_professional(turns: list[dict[str, Any]], label: str) -> bool:
    spoken = [t for t in turns if t["speaker"] == label]
    return sum(1 for t in spoken if _PROFESSIONAL_TALK.search(t["text"])) >= 3


def unlocks(suggestions: list[Suggestion], label: str) -> dict[str, str]:
    mine = [s for s in suggestions if any(q["speaker"] == label for q in s["quotes"])]
    facts = [s for s in mine if FIELDS[s["field"]].support != "owner"]
    finance = [s for s in mine if FIELDS[s["field"]].support == "household-or-professional"]
    actions = [s for s in mine if FIELDS[s["field"]].support == "owner" and label in (s.get("owners") or [])]

    def n(count: int, one: str, many: str) -> str:
        return f"{count} {one if count == 1 else many}"

    return {
        "household": f"As a client: {n(len(facts), 'statement becomes a buyer requirement or profile fact', 'statements become buyer requirements or profile facts')}.",
        "professional": f"As a professional: {n(len(finance), 'statement', 'statements')} can be recorded as finance facts or professionals; the rest stay their own words.",
        "agent": f"As you: {n(len(actions), 'next action becomes yours', 'next actions become yours')}. Your words alone never become buyer requirements.",
        "other": "As someone else: their words are never recorded as buyer requirements.",
    }


def guess_speakers(
    labels: list[str], clients: list[dict[str, Any]], *, notes: bool
) -> dict[str, dict[str, Any] | None]:
    by_name = {c["name"].strip().lower(): c for c in clients}
    guesses: dict[str, dict[str, Any] | None] = {}
    for label in labels:
        client = by_name.get(label.strip().lower())
        if notes:
            guesses[label] = _match("agent", "", guessed=True)
        elif client:
            guesses[label] = _match("household", client["name"], person_id=str(client["id"]), guessed=True)
        else:
            guesses[label] = None
    return guesses


def _match(
    kind: str, name: str, *, role: str = "", person_id: str | None = None, is_new: bool = False,
    guessed: bool = False,
) -> dict[str, Any]:
    match: dict[str, Any] = {
        "kind": kind, "name": name, "role": role, "person_id": person_id, "is_new": is_new, "guessed": guessed,
    }
    return match


def initial_state(
    *,
    turns: list[dict[str, Any]],
    suggestions: list[Suggestion],
    dropped: list[Suggestion],
    people: list[str],
    existing: dict[str, dict[str, Any]],
    guesses: dict[str, dict[str, Any] | None],
    source_kind: str,
) -> State:
    labels = list(dict.fromkeys(t["speaker"] for t in turns))
    return {
        "stage": "speakers",
        "source_kind": source_kind,
        "labels": labels,
        "speakers": {label: guesses.get(label) for label in labels},
        "suggestions": suggestions,
        "dropped": dropped,
        "people": list(people),
        "existing": existing,
        "decisions": {},
        "seq": 0,
        "last": {"ok": True, "text": "Match each speaker label to a person. Suggestions stay hidden until every speaker is matched."},
    }


# ---- Derived views ------------------------------------------------------------------------------


def record_key(field: str, subject: str | None) -> str:
    return f"{field}|{subject}" if FIELDS[field].per_person and subject else field


def _kind_of(st: State, label: str) -> str | None:
    m = st["speakers"].get(label)
    return m["kind"] if m else None


def name_of(st: State, label: str) -> str:
    m = st["speakers"].get(label)
    if not m or not m.get("name"):
        return label
    if m["kind"] == "agent":
        return f"{m['name']} (you)"
    if m["kind"] in ("professional", "other") and m.get("role"):
        return f"{m['name']} ({m['role'].lower()})"
    return str(m["name"])


def _names(st: State, quotes: list[dict[str, Any]]) -> str:
    return " and ".join(dict.fromkeys(name_of(st, q["speaker"]) for q in quotes))


def derive_record(st: State) -> dict[str, Any]:
    """What the record says if the decisions so far were applied: existing values, overlaid in
    decision order. Nothing is written anywhere until the review is finished."""
    record: dict[str, Any] = {}
    for key, e in st["existing"].items():
        record[key] = {**e, "status": "on record", "history": [], "sid": None}
    by_id = {s["id"]: s for s in st["suggestions"]}
    for sid, d in sorted(st["decisions"].items(), key=lambda kv: kv[1]["seq"]):
        if d["status"] not in WRITTEN:
            continue
        s = by_id[sid]
        field = FIELDS[s["field"]]
        entry = {
            "sid": sid, "field": s["field"], "subject": s.get("subject"), "value": d["value"],
            "status": d["status"], "basis": s["basis"], "quotes": d["quotes"], "owners": s.get("owners"),
            "due": s.get("due"), "outcome": s.get("outcome"),
        }
        if field.kind == "one":
            key = record_key(s["field"], s.get("subject"))
            prev = record.get(key)
            entry["history"] = (prev["history"] + [{"value": prev["value"], "source": prev.get("source")}]) if prev else []
            record[key] = entry
        else:
            record.setdefault(s["field"], []).append(entry)
    return record


def assess(st: State, s: Suggestion, record: dict[str, Any]) -> dict[str, Any]:
    field = FIELDS[s["field"]]
    kinds = [_kind_of(st, q["speaker"]) for q in s["quotes"]]
    if st["source_kind"] == "notes":  # the agent's own notes report what the household said
        kinds = ["household" if k == "agent" else k for k in kinds]
    blocked = tag = None
    if field.support == "owner":
        if not any(q["speaker"] in (s.get("owners") or []) for q in s["quotes"]):
            blocked = f"Nobody who owes this said they would do it. Only {_names(st, s['quotes'])} spoke."
            tag = "No commitment from who owes it"
    else:
        allowed = ("household",) if field.support == "household" else ("household", "professional")
        if not any(k in allowed for k in kinds):
            tag = "Not said by the buyers"
            if "professional" in kinds or "other" in kinds:
                blocked = (
                    f"Only {_names(st, s['quotes'])} said this. Someone else's figure stays their own "
                    "fact; it becomes the buyers' only if a buyer accepts it."
                )
            elif "agent" in kinds:
                blocked = "Only you (the agent) said this. It counts once a buyer confirms it."
            else:
                blocked = "No household member said this."
    reasons: list[dict[str, str]] = []
    if blocked and tag:
        reasons.append({"code": "blocked", "tone": "bad", "text": tag})
    conflict = s.get("conflict") or {}
    if conflict.get("type") == "superseded":
        reasons.append({"code": "changed", "tone": "warn", "text": "Changed during the call"})
    if conflict.get("type") == "disagreement":
        reasons.append({"code": "disagree", "tone": "warn", "text": "Decision makers disagree"})
    current = record.get(record_key(s["field"], s.get("subject"))) if field.kind == "one" else None
    if current and current.get("sid") != s["id"]:
        reasons.append({"code": "replaces", "tone": "warn", "text": "Would replace a value on record"})
    if s["basis"] == "inferred":
        reasons.append({"code": "inferred", "tone": "warn", "text": "Inferred"})
    decision = st["decisions"].get(s["id"])
    bucket = "done" if decision else "decide" if reasons else "ready"
    return {"s": s, "blocked": blocked, "reasons": reasons, "current": current, "decision": decision, "bucket": bucket}


def queue(st: State) -> list[dict[str, Any]]:
    record = derive_record(st)
    return [assess(st, s, record) for s in st["suggestions"]]


# ---- The reducer ------------------------------------------------------------------------------------


class Refused(Exception):
    """An action the agreed rules forbid. The state is unchanged."""


def _matched(m: dict[str, Any] | None) -> bool:
    return bool(m and m.get("kind") and (m.get("name") or "").strip() or (m and m.get("kind") == "agent"))


def reduce(state: State, a: dict[str, Any]) -> State:
    """Apply one action. Raises Refused (and changes nothing) if the rules forbid it."""
    st = copy.deepcopy(state)
    by_id = {s["id"]: s for s in st["suggestions"]}
    sid = a.get("id")
    s = by_id.get(sid) if sid else None

    def done(text: str, **patch: Any) -> State:
        st.update(patch)
        st["seq"] += 1
        st["last"] = {"ok": True, "text": text}
        return st

    def label_of(x: Suggestion) -> str:
        v = x["value"]
        return f"{FIELDS[x['field']].item}: {v if len(v) <= 60 else v[:57] + '…'}"

    def item_guard() -> dict[str, Any]:
        if st["stage"] != "review":
            raise Refused("Suggestions can only be decided on the review step.")
        if s is None:
            raise Refused("No such suggestion.")
        if sid in st["decisions"]:
            raise Refused(f"Already decided ({st['decisions'][sid]['status']}). Undo to change it.")
        found: dict[str, Any] = s
        return found

    def decide(x: Suggestion, status: str, value: str | None = None, quotes: list[Any] | None = None) -> None:
        st["decisions"][x["id"]] = {"status": status, "value": value, "quotes": quotes or [], "seq": st["seq"] + 1}

    kind = a["type"]
    if kind == "matchSpeaker":
        if st["stage"] != "speakers":
            raise Refused("Speakers are locked while you review. Go back to speaker matching first.")
        if a["label"] not in st["speakers"]:
            raise Refused(f"There is no speaker “{a['label']}” in this call.")
        k = a.get("kind")
        if k is None:
            st["speakers"][a["label"]] = None
            return done(f"Cleared the match for “{a['label']}”.")
        if k not in KINDS:
            raise Refused(f"Unknown kind of person: {k}.")
        m = _match(k, a.get("name") or "", role=a.get("role") or "", person_id=a.get("person_id"), is_new=bool(a.get("is_new")))
        st["speakers"][a["label"]] = m
        who = "you" if k == "agent" else m["name"] or "a person still to be named"
        return done(f"Matched “{a['label']}” to {who}.")
    if kind == "confirmSpeakers":
        if st["stage"] != "speakers":
            raise Refused("Speakers are already confirmed.")
        missing = [lab for lab in st["labels"] if not _matched(st["speakers"][lab])]
        if missing:
            names = ", ".join(f"“{m}”" for m in missing)
            raise Refused(f"Match every speaker first: {names} {'are' if len(missing) > 1 else 'is'} not matched to a person.")
        agents = [lab for lab in st["labels"] if _kind_of(st, lab) == "agent"]
        if len(agents) != 1:
            raise Refused("Only one speaker can be you." if agents else "Say which speaker is you, the agent who ran the call. Only that person reviews.")
        people = list(st["people"])
        for lab in st["labels"]:
            m = st["speakers"][lab]
            if m["kind"] == "household" and m["name"] not in people:
                people.append(m["name"])
            m["guessed"] = False
        return done(f"Speakers confirmed. {len(st['suggestions'])} suggestions are now showing.", stage="review", people=people)
    if kind == "editSpeakers":
        if st["stage"] == "speakers":
            raise Refused("You are already matching speakers.")
        if st["stage"] == "result":
            raise Refused("The review is finished; its speakers can no longer change.")
        if st["decisions"]:
            raise Refused("Speakers are locked once a suggestion has been decided, because attribution has already been used. Undo those decisions first.")
        return done("Back to speaker matching. Suggestions are hidden again.", stage="speakers")
    if kind in ("accept", "edit"):
        x = item_guard()
        record = derive_record(st)
        info = assess(st, x, record)
        if info["blocked"]:
            raise Refused(f"Can't apply “{label_of(x)}”. {info['blocked']}")
        conflict = x.get("conflict") or {}
        discuss = conflict.get("type") == "disagreement"
        if kind == "edit":
            v = (a.get("value") or "").strip()
            if not v:
                raise Refused("An edited value cannot be empty. Reject it instead.")
            if v != x["value"]:
                decide(x, "edited", v, x["quotes"])
                return done(f"Edited and applied “{FIELDS[x['field']].item}”. The quote stays with it as the source.")
        extra = f" It replaced “{info['current']['value']}”, which stays in the field's history." if info["current"] else ""
        decide(x, "discuss" if discuss else "accepted", x["value"], x["quotes"])
        return done(f"{'Kept as “to discuss”' if discuss else 'Applied'} “{label_of(x)}”.{extra}")
    if kind == "useEarlier":
        x = item_guard()
        conflict = x.get("conflict") or {}
        if conflict.get("type") != "superseded":
            raise Refused("Only a value that changed during the call has an earlier value.")
        info = assess(st, x, derive_record(st))
        if info["blocked"]:
            raise Refused(f"Can't apply “{label_of(x)}”. {info['blocked']}")
        decide(x, "earlier", conflict["earlier"]["value"], conflict["earlier"]["quotes"])
        return done(f"Applied the earlier value “{conflict['earlier']['value']}” for {FIELDS[x['field']].item}.")
    if kind == "reject":
        x = item_guard()
        decide(x, "rejected")
        return done(f"Rejected “{label_of(x)}”. Nothing was written.")
    if kind == "ask":
        x = item_guard()
        decide(x, "ask")
        return done(f"Added “{label_of(x)}” to Ask the client. Nothing was written to the record.")
    if kind == "undo":
        if st["stage"] != "review":
            raise Refused("Decisions can only be undone on the review step.")
        if s is None or sid not in st["decisions"]:
            raise Refused("There is no decision to undo for that suggestion.")
        del st["decisions"][sid]
        return done(f"Undid the decision on “{label_of(s)}”.")
    if kind == "acceptRest":
        if st["stage"] != "review":
            raise Refused("Suggestions can only be decided on the review step.")
        ready = [x for x in queue(st) if x["bucket"] == "ready"]
        if not ready:
            raise Refused("Nothing left that is safe to accept together.")
        for x in ready:
            decide(x["s"], "accepted", x["s"]["value"], x["s"]["quotes"])
            st["seq"] += 1
        left = sum(1 for x in queue(st) if x["bucket"] == "decide")
        tail = f" {left} still need your decision; they were not touched." if left else ""
        return done(f"Accepted {len(ready)} stated, unconflicted suggestions together.{tail}")
    if kind == "finish":
        if st["stage"] != "review":
            raise Refused("Finish from the review step.")
        open_count = sum(1 for x in queue(st) if x["bucket"] != "done")
        tail = f" {open_count} suggestion{'s were' if open_count > 1 else ' was'} left undecided, so nothing was written for {'them' if open_count > 1 else 'it'}." if open_count else ""
        return done(f"Review finished.{tail}", stage="result")
    raise Refused(f"Unknown action {kind}")


# ---- What the reviewed record now says ---------------------------------------------------------------


def summary(st: State) -> dict[str, Any]:
    record = derive_record(st)
    entries: dict[str, list[dict[str, Any]]] = {k: [] for k, _ in SECTIONS}
    to_discuss: list[dict[str, Any]] = []
    not_covered: list[str] = []
    purpose = record.get("purpose")
    for fid, f in FIELDS.items():
        values: list[dict[str, Any]] = []
        for key, v in record.items():
            if key == fid or key.startswith(fid + "|"):
                values.extend(v if isinstance(v, list) else [v])
        for e in values:
            if e["status"] == "on record":
                continue
            (to_discuss if e["status"] == "discuss" else entries[f.section]).append({"field": fid, "label": f.item, "entry": e})
        settled = any(e["status"] not in ("discuss",) for e in values)
        if not settled and fid not in ("properties", "nextActions", "notes", "professionals"):
            not_covered.append(_not_covered(f, record, purpose, bool(values)))
    q = queue(st)
    return {
        "entries": entries,
        "to_discuss": to_discuss,
        "not_covered": not_covered,
        "ask": [x["s"]["id"] for x in q if x["decision"] and x["decision"]["status"] == "ask"],
        "rejected": [x["s"]["id"] for x in q if x["decision"] and x["decision"]["status"] == "rejected"],
        "undecided": [x["s"]["id"] for x in q if not x["decision"]],
        "written": sum(1 for x in q if x["decision"] and x["decision"]["status"] in WRITTEN),
    }


def _not_covered(f: Field, record: dict[str, Any], purpose: dict[str, Any] | None, has_values: bool) -> str:
    if f.investor_only and purpose and not re.search("invest", purpose["value"], re.I):
        return f"{f.label}: not applicable (buying a home to live in)"
    if f.partly_field and f.partly_pattern:
        listed = record.get(f.partly_field) or []
        if any(re.search(f.partly_pattern, e["value"], re.I) for e in listed):
            return f"{f.label}: {f.partly_text}"
    return f"{f.label}: undecided (to discuss)" if has_values else f.label
