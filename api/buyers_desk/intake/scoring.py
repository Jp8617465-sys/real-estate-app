"""Scoring an extractor against the answer keys, and the no-cost extractor that replays them.

The pass bar (spec): no invented details; no buyer requirement taken from another speaker; every
budget figure, deal-breaker and next action found; about 8 in 10 of the other fields found.

What the scorer can and cannot see. It is deterministic code, no model:
- found: a key item counts as found when a kept suggestion has its field and quotes a turn the key
  quotes (and, for areas and must-haves/deal-breakers/nice-to-haves, names the same thing).
- invented: a kept suggestion that matches no key item AND either rests only on a quote the key
  lists under "Must NOT be suggested" / "Confirm with client", or rests on no quote the key knows.
  An embellished value on an otherwise correct item (an invented job title, say) is NOT detected;
  James's review of the report remains the check for that.
- other-speaker requirements: a kept suggestion in a field only the buyers can state, whose quotes
  all come from the agent or someone outside the household.
"""
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from buyers_desk.intake import review
from buyers_desk.intake.extraction import ExtractionRequest, Extractor
from buyers_desk.intake.fields import FIELDS
from buyers_desk.intake.keys import AnswerKey, KeyItem, load_keys

OTHER_SHARE_BAR = 0.8


@dataclass
class Report:
    extractor: str
    key_total: int = 0
    key_found: int = 0
    other_total: int = 0
    other_found: int = 0
    key_missing: list[str] = field(default_factory=list)
    other_missing: list[str] = field(default_factory=list)
    invented: list[str] = field(default_factory=list)
    other_speaker_requirements: list[str] = field(default_factory=list)
    dropped_total: int = 0
    dropped_reasons: list[str] = field(default_factory=list)
    transcripts: int = 0
    usage: dict[str, float] = field(default_factory=dict)  # input_tokens, output_tokens, usd, seconds

    @property
    def other_share(self) -> float:
        return self.other_found / self.other_total if self.other_total else 1.0

    @property
    def passed(self) -> bool:
        return (
            not self.invented
            and not self.other_speaker_requirements
            and not self.key_missing
            and self.other_share >= OTHER_SHARE_BAR
        )

    def render(self) -> str:
        def mark(ok: bool) -> str:
            return "PASS" if ok else "FAIL"

        lines = [
            f"Scored run: {self.extractor} over {self.transcripts} transcripts",
            f"  {mark(not self.invented)}  invented details: {len(self.invented)}",
            f"  {mark(not self.other_speaker_requirements)}  requirements taken from another speaker: {len(self.other_speaker_requirements)}",
            f"  {mark(not self.key_missing)}  budget figures, pre-approval, deal-breakers and next actions found: {self.key_found}/{self.key_total}",
            f"  {mark(self.other_share >= OTHER_SHARE_BAR)}  other fields found: {self.other_found}/{self.other_total} ({self.other_share:.0%}; bar {OTHER_SHARE_BAR:.0%})",
            f"  info  suggestions dropped by the quote and contract check: {self.dropped_total}",
        ]
        for title, items in (
            ("Invented", self.invented), ("From another speaker", self.other_speaker_requirements),
            ("Key items missed", self.key_missing), ("Other fields missed", self.other_missing[:12]),
            ("Dropped", self.dropped_reasons[:8]),
        ):
            if items:
                lines.append(f"{title}:")
                lines.extend(f"    - {i}" for i in items)
        if self.usage:
            u = self.usage
            lines.append(f"  cost: US${u.get('usd', 0):.2f}  time: {u.get('seconds', 0):.0f}s  tokens in/out: {u.get('input_tokens', 0):.0f}/{u.get('output_tokens', 0):.0f}")
        lines.append(f"RESULT: {'PASSES the bar' if self.passed else 'DOES NOT PASS the bar'}")
        return "\n".join(lines)


def _cue(turns: Sequence[dict[str, Any]], speaker: str, text: str) -> int | None:
    for t in turns:
        if t["speaker"] == speaker and text in t["text"]:
            return int(t["n"])
    return None


def _matches(item: KeyItem, cues: set[int], s: dict[str, Any]) -> bool:
    if s["field"] != item.field:
        return False
    if not cues & {int(q["cue"]) for q in s["quotes"]}:
        return False
    if item.tokens:
        return any(tok in s["value"].lower() for tok in item.tokens)
    return True


def score_transcript(key: AnswerKey, raw: list[dict[str, Any]], report: Report) -> None:
    kept, dropped = review.check_suggestions(key.turns, raw)
    report.transcripts += 1
    report.dropped_total += len(dropped)
    report.dropped_reasons.extend(f"{key.number} {d.get('id')}: {d['reason']}" for d in dropped)
    item_cues = [
        (item, {c for sp, q in item.quotes if (c := _cue(key.turns, sp, q)) is not None}) for item in key.items
    ]
    for item, cues in item_cues:
        if not item.scored:
            continue
        found = any(_matches(item, cues, s) for s in kept)
        if item.key:
            report.key_total += 1
            report.key_found += found
            if not found:
                report.key_missing.append(f"{key.number} {item.label}")
        else:
            report.other_total += 1
            report.other_found += found
            if not found:
                report.other_missing.append(f"{key.number} {item.label}")

    all_cues = {c for _, cs in item_cues for c in cs}
    trap_cues = {c for sp, q in [*key.must_not, *key.confirm] if (c := _cue(key.turns, sp, q)) is not None}
    for conflict in key.conflicts:
        for sp, q in [*conflict["one"], *conflict["other"]]:
            if (c := _cue(key.turns, sp, q)) is not None:
                all_cues.add(c)
    for s in kept:
        cues = {int(q["cue"]) for q in s["quotes"]}
        if any(_matches(item, ic, s) for item, ic in item_cues):
            pass
        elif cues & trap_cues:
            report.invented.append(f"{key.number} {s['field']}: {s['value'][:70]} (rests on a must-not-be-suggested quote)")
        elif not cues & all_cues:
            report.invented.append(f"{key.number} {s['field']}: {s['value'][:70]} (no quote the key knows)")
        f = FIELDS[s["field"]]
        if f.support == "household" and key.kind != "notes":
            if not any(key.roles.get(q["speaker"]) == "household" for q in s["quotes"]):
                report.other_speaker_requirements.append(f"{key.number} {s['field']}: {s['value'][:70]}")


def score_all(extractor: Extractor, keys: Sequence[AnswerKey] | None = None) -> Report:
    report = Report(extractor.name)
    for key in keys if keys is not None else load_keys():
        raw = extractor.extract(ExtractionRequest(turns=key.turns, fields=list(FIELDS.values())))
        score_transcript(key, raw, report)
    return report


# ---- Replaying a key as suggestions (no model, no cost) ---------------------------------------------------


def key_to_suggestions(key: AnswerKey) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for n, item in enumerate(key.items):
        s: dict[str, Any] = {
            "id": f"k{key.number}-{n}", "field": item.field,
            "value": f"{item.label.split(':', 1)[1].strip()} — {item.value}" if item.field == "areas" and ":" in item.label else item.value,
            "basis": item.basis,
            "quotes": [{"speaker": sp, "text": q} for sp, q in item.quotes],
        }
        if item.subject:
            s["subject"] = item.subject
        if item.field == "nextActions":
            s["owners"] = item.owners
            s["due"] = item.due
        if item.outcome:
            s["outcome"] = item.outcome
        out.append(s)
    return out


def key_replays(keys: Sequence[AnswerKey]) -> dict[str, list[dict[str, Any]]]:
    """fingerprint -> suggestions, so the app's scripted extractor can demo every synthetic transcript."""
    from buyers_desk.intake.extraction import fingerprint

    return {fingerprint(k.turns): key_to_suggestions(k) for k in keys}


class KeyReplayExtractor:
    """Replays the answer key for a transcript it recognises: what a perfect extractor returns."""

    name = "answer-key replay"

    def __init__(self, keys: Sequence[AnswerKey]) -> None:
        from buyers_desk.intake.extraction import fingerprint

        self._by_print = {fingerprint(k.turns): key_to_suggestions(k) for k in keys}

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]:
        from buyers_desk.intake.extraction import fingerprint

        return list(self._by_print.get(fingerprint(request.turns), []))
