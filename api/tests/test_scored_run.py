"""Ticket 64: the scored run measures an extractor against James's approved answer keys.

The scorer is itself checked by replaying the keys through the scripted extractor, which must
pass the bar at no cost; deliberate faults must fail it. No model is called here.
"""
from typing import Any

from buyers_desk.intake.extraction import ExtractionRequest
from buyers_desk.intake.keys import load_keys
from buyers_desk.intake.scoring import KeyReplayExtractor, score_all

KEYS = load_keys()


class Faulty:
    """Wraps the key replay and changes its output, to prove the scorer notices."""

    name = "faulty replay"

    def __init__(self, change: Any) -> None:
        self._inner = KeyReplayExtractor(KEYS)
        self._change = change

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]:
        return self._change(self._inner.extract(request), request)  # type: ignore[no-any-return]


def test_there_are_seven_answer_keys_with_their_key_items() -> None:
    assert [k.number for k in KEYS] == ["01", "02", "03", "04", "05", "06", "07"]
    assert all(sum(1 for i in k.items if i.key) > 0 for k in KEYS)


def test_replaying_the_answer_keys_passes_the_bar() -> None:
    report = score_all(KeyReplayExtractor(KEYS), KEYS)

    assert report.passed, report.render()
    assert report.invented == []
    assert report.other_speaker_requirements == []
    assert report.key_missing == []
    assert report.key_found == report.key_total > 40
    assert report.other_share >= 0.8
    assert report.dropped_total == 0


def test_a_missing_deal_breaker_fails_the_bar() -> None:
    def drop_one_deal_breaker(raw: list[dict[str, Any]], _: ExtractionRequest) -> list[dict[str, Any]]:
        removed = False
        out = []
        for s in raw:
            if s["field"] == "dealBreakers" and not removed:
                removed = True
                continue
            out.append(s)
        return out

    report = score_all(Faulty(drop_one_deal_breaker), KEYS)

    assert not report.passed
    assert len(report.key_missing) >= 1
    assert all("Deal-breaker" in m for m in report.key_missing[:1])


def test_a_buyer_requirement_quoted_only_from_another_speaker_fails_the_bar() -> None:
    def broker_ceiling(raw: list[dict[str, Any]], request: ExtractionRequest) -> list[dict[str, Any]]:
        found = [t for t in request.turns if "nine-fifty" in t["text"] and t["speaker"] == "iPhone (2)"]
        if not found:
            return raw
        turn = found[0]
        return [
            *raw,
            {
                "id": "x", "field": "budgetCeiling", "value": "$950k", "basis": "stated",
                "quotes": [{"speaker": turn["speaker"], "text": turn["text"]}],
            },
        ]

    report = score_all(Faulty(broker_ceiling), KEYS)

    assert not report.passed
    assert any("budgetCeiling" in s for s in report.other_speaker_requirements)


def test_a_suggestion_with_an_invented_quote_is_dropped_counted_and_reported() -> None:
    def invented(raw: list[dict[str, Any]], _: ExtractionRequest) -> list[dict[str, Any]]:
        bogus = {
            "id": "bogus", "field": "pets", "value": "A parrot", "basis": "stated",
            "quotes": [{"speaker": "Tash Kumar", "text": "We have a parrot called Kevin."}],
        }
        return [*raw, bogus]

    report = score_all(Faulty(invented), KEYS)

    assert report.dropped_total == 7  # one invented quote per transcript; the quote check removes it
    assert report.passed  # dropped suggestions never reach review, so they do not fail the bar


def test_a_suggestion_resting_on_a_must_not_be_suggested_quote_counts_as_invented() -> None:
    def trap(raw: list[dict[str, Any]], request: ExtractionRequest) -> list[dict[str, Any]]:
        icu = [t for t in request.turns if t["text"] == "At the hospital at Chermside. In ICU."]
        if not icu:
            return raw
        turn = icu[0]
        return [
            *raw,
            {
                "id": "nurse", "field": "properties", "value": "Chermside", "basis": "stated",
                "quotes": [{"speaker": turn["speaker"], "text": turn["text"]}],
            },
        ]

    report = score_all(Faulty(trap), KEYS)

    assert not report.passed
    assert len(report.invented) >= 1
