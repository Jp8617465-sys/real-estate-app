"""Ticket 64: the Claude adapter, the spend ledger that holds the US$50 cap, and the command that
asks before any paid call. The Claude client is a stand-in: no key is read, no money is spent.
"""
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from buyers_desk.intake.claude import ClaudeExtractor, ExtractionError, estimate_cost
from buyers_desk.intake.extraction import ExtractionRequest
from buyers_desk.intake.fields import FIELDS
from buyers_desk.intake.keys import load_keys
from buyers_desk.intake.ledger import LedgerCapExceeded, SpendLedger
from buyers_desk.intake.scoring import key_to_suggestions
from buyers_desk.scored_run import main

KEYS = load_keys()


class FakeClaude:
    """Returns the answer key for each transcript in turn, with plausible usage."""

    def __init__(self, stop_reason: str = "end_turn") -> None:
        self.calls: list[dict[str, Any]] = []
        self.messages = self
        self._stop = stop_reason

    def create(self, **kwargs: Any) -> Any:
        key = KEYS[len(self.calls) % len(KEYS)]
        self.calls.append(kwargs)
        body = json.dumps({"suggestions": key_to_suggestions(key)})
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=body)], stop_reason=self._stop,
            usage=SimpleNamespace(input_tokens=30_000, output_tokens=7_000),
        )


def request_for(number: str) -> ExtractionRequest:
    key = next(k for k in KEYS if k.number == number)
    return ExtractionRequest(turns=key.turns, fields=list(FIELDS.values()))


def test_the_adapter_returns_the_suggestions_the_model_produced_and_names_the_model(tmp_path: Path) -> None:
    fake = FakeClaude()
    extractor = ClaudeExtractor("claude-sonnet-5-5", client=fake, ledger=SpendLedger(tmp_path / "l.json"))

    suggestions = extractor.extract(request_for("01"))

    assert extractor.name == "claude-sonnet-5-5"
    assert len(suggestions) == len(key_to_suggestions(KEYS[0]))
    sent = fake.calls[0]
    assert sent["model"] == "claude-sonnet-5-5"
    assert "Speaker" in sent["messages"][0]["content"] or "Tom Kerrigan" in sent["messages"][0]["content"]
    assert sent["output_config"]["format"]["type"] == "json_schema"


def test_a_refusal_or_a_cut_off_answer_is_an_error_not_a_silent_empty_result(tmp_path: Path) -> None:
    for stop in ("refusal", "max_tokens"):
        extractor = ClaudeExtractor("claude-haiku-5-5", client=FakeClaude(stop), ledger=SpendLedger(tmp_path / f"{stop}.json"))
        with pytest.raises(ExtractionError, match=stop):
            extractor.extract(request_for("01"))


def test_the_ledger_remembers_spend_across_runs_and_refuses_to_pass_the_cap(tmp_path: Path) -> None:
    path = tmp_path / "ledger.json"
    SpendLedger(path).record("claude-opus-5-5", 40.0, "first run")

    ledger = SpendLedger(path)  # a new process reads the same file
    assert ledger.total == 40.0
    ledger.reserve(9.99)
    with pytest.raises(LedgerCapExceeded, match="US\\$50"):
        ledger.reserve(10.01)


def test_the_adapter_records_actual_spend_and_refuses_a_call_that_would_pass_the_cap(tmp_path: Path) -> None:
    ledger = SpendLedger(tmp_path / "l.json")
    extractor = ClaudeExtractor("claude-sonnet-5-5", client=FakeClaude(), ledger=ledger)

    extractor.extract(request_for("01"))

    assert ledger.total == pytest.approx(30_000 * 2 / 1e6 + 7_000 * 10 / 1e6)
    ledger.record("claude-opus-5-5", 49.9, "earlier")
    fake = FakeClaude()
    with pytest.raises(LedgerCapExceeded):
        ClaudeExtractor("claude-opus-5-5", client=fake, ledger=ledger).extract(request_for("02"))
    assert fake.calls == []  # refused before the call


def test_the_estimate_orders_the_models_by_price() -> None:
    sizes = [len(k.text) for k in KEYS]
    costs = {m: estimate_cost(m, sizes) for m in ("claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5")}

    assert costs["claude-haiku-5-5"] < costs["claude-sonnet-5-5"] < costs["claude-opus-5-5"]
    assert costs["claude-opus-5-5"] < 50


def test_the_command_asks_before_any_paid_call_and_calls_nothing_if_declined(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fake = FakeClaude()

    code = main(["--model", "claude-sonnet-5-5"], ask=lambda _: "n", client=fake, ledger_path=tmp_path / "l.json")

    out = capsys.readouterr().out
    assert "Estimated cost" in out and "US$" in out
    assert code == 1 and fake.calls == []


def test_the_command_scores_all_seven_transcripts_and_reports_cost_and_time(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    fake = FakeClaude()

    code = main(["--model", "claude-sonnet-5-5"], ask=lambda _: "y", client=fake, ledger_path=tmp_path / "l.json")

    out = capsys.readouterr().out
    assert len(fake.calls) == 7
    assert "RESULT: PASSES the bar" in out
    assert "cost: US$" in out and "time:" in out
    assert code == 0
    assert SpendLedger(tmp_path / "l.json").total > 0


def test_the_command_refuses_a_run_that_would_pass_the_cap_before_asking(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    SpendLedger(tmp_path / "l.json").record("claude-opus-5-5", 49.99, "earlier")
    asked: list[str] = []

    def ask(prompt: str) -> str:
        asked.append(prompt)
        return "y"

    code = main(["--model", "claude-opus-5-5"], ask=ask, client=FakeClaude(), ledger_path=tmp_path / "l.json")

    assert code == 2 and asked == []
    assert "US$50" in capsys.readouterr().out


def test_the_command_can_score_the_answer_keys_at_no_cost(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["--replay-keys"], ask=lambda _: "n")

    assert code == 0
    assert "RESULT: PASSES the bar" in capsys.readouterr().out
