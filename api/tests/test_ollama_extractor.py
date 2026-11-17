"""Ticket 65 (code part): a local Qwen extractor behind the same port, for the model comparison.

Ollama and the model run on James's Mac, so these tests use a stand-in HTTP server. No cost, no key.
"""
import json
from typing import Any

import httpx2 as httpx
import pytest

from buyers_desk.intake.claude import ExtractionError
from buyers_desk.intake.extraction import ExtractionRequest
from buyers_desk.intake.fields import FIELDS
from buyers_desk.intake.keys import load_keys
from buyers_desk.intake.ollama import DEFAULT_MODEL, OllamaExtractor
from buyers_desk.intake.scoring import key_to_suggestions, score_all
from buyers_desk.scored_run import main

KEYS = load_keys()


def server(seen: list[dict[str, Any]], status: int = 200) -> httpx.MockTransport:
    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append({"url": str(request.url), **body})
        key = KEYS[(len(seen) - 1) % len(KEYS)]
        reply = {"message": {"content": json.dumps({"suggestions": key_to_suggestions(key)})}, "done": True,
                 "prompt_eval_count": 9000, "eval_count": 3000}
        return httpx.Response(status, json=reply)

    return httpx.MockTransport(handle)


def request_for(number: str) -> ExtractionRequest:
    key = next(k for k in KEYS if k.number == number)
    return ExtractionRequest(turns=key.turns, fields=list(FIELDS.values()))


def test_the_adapter_asks_the_local_ollama_for_json_and_returns_its_suggestions() -> None:
    seen: list[dict[str, Any]] = []
    extractor = OllamaExtractor(transport=server(seen))

    suggestions = extractor.extract(request_for("03"))

    assert extractor.name == DEFAULT_MODEL == "qwen3.5:9b"
    assert len(suggestions) == len(key_to_suggestions(KEYS[0]))  # the stand-in answers with the first key
    assert seen[0]["url"] == "http://127.0.0.1:11434/api/chat"
    assert seen[0]["model"] == "qwen3.5:9b" and seen[0]["stream"] is False
    assert seen[0]["format"]["type"] == "object"  # the same JSON schema as the Claude adapter


def test_an_unreachable_or_failing_ollama_is_an_error_that_says_how_to_start_it() -> None:
    def down(_: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    with pytest.raises(ExtractionError, match="ollama"):
        OllamaExtractor(transport=httpx.MockTransport(down)).extract(request_for("01"))
    with pytest.raises(ExtractionError, match="500"):
        OllamaExtractor(transport=server([], status=500)).extract(request_for("01"))


def test_an_answer_that_is_not_the_agreed_json_is_an_error() -> None:
    bad = httpx.MockTransport(lambda _: httpx.Response(200, json={"message": {"content": "sure! here you go"}}))

    with pytest.raises(ExtractionError, match="JSON"):
        OllamaExtractor(transport=bad).extract(request_for("01"))


def test_the_scorer_runs_a_local_model_at_no_cost() -> None:
    seen: list[dict[str, Any]] = []

    report = score_all(OllamaExtractor(transport=server(seen)), KEYS)

    assert report.passed  # the stand-in answers with the keys
    assert len(seen) == 7


def test_the_command_runs_a_local_model_without_asking_to_spend_or_touching_the_ledger(
    capsys: pytest.CaptureFixture[str],
) -> None:
    seen: list[dict[str, Any]] = []

    code = main(["--ollama", "qwen3.5:9b"], ask=lambda _: pytest.fail("a local run must not ask to spend"), ollama_transport=server(seen))

    out = capsys.readouterr().out
    assert code == 0 and "qwen3.5:9b" in out and "RESULT: PASSES the bar" in out
    assert "cost: US$0.00" in out
