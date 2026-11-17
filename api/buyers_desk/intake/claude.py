"""The Claude API adapter for the extraction port.

The key comes from the environment (ANTHROPIC_API_KEY or an `ant auth login` profile), read only by
the SDK; this code never reads, prints or logs it. Which model runs is configuration. Nothing here
falls back to another model: a scored run must measure the model it names.
"""
import json
import time
from collections.abc import Sequence
from typing import Any

from buyers_desk.intake.extraction import ExtractionRequest
from buyers_desk.intake.fields import FIELDS
from buyers_desk.intake.ledger import SpendLedger

# US$ per million tokens (input, output), from the published price list on 3 November 2026.
# Haiku 5.5's figure is for prompts up to 100K tokens, which every test transcript is.
PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.0, 20.0),
    "claude-sonnet-5-5": (2.0, 10.0),
    "claude-haiku-5-5": (0.10, 0.50),
}
MAX_TOKENS = 16_000
_CHARS_PER_TOKEN = 3.0  # deliberately pessimistic; the estimate should not under-call the ledger


class ExtractionError(Exception):
    pass


def price_of(model: str) -> tuple[float, float]:
    if model not in PRICES:
        raise ExtractionError(f"No price on file for {model}. Known: {', '.join(PRICES)}")
    return PRICES[model]


def estimate_cost(model: str, transcript_chars: Sequence[int]) -> float:
    """An upper-leaning estimate: the full prompt in, and a typical answer (about 9K tokens) out."""
    pin, pout = price_of(model)
    total = 0.0
    for chars in transcript_chars:
        tokens_in = chars / _CHARS_PER_TOKEN + 2_500
        total += tokens_in * pin / 1e6 + 9_000 * pout / 1e6
    return total


_SYSTEM = """You extract suggestions from a buyers agent's first call with prospective clients, for the agent to review. \
Be cautious: a suggestion the agent must reject costs more than one you leave out.

Every suggestion must be backed by quotes copied character for character from the transcript. Each quote must sit inside ONE speaker turn and name that turn's speaker label exactly. \
Copy transcription errors as spoken; put any normalised value (Lutwitch -> Lutwyche) in "value", never in the quote.

Rules:
- Mark each suggestion "stated" (said outright) or "inferred" (follows from what was said). Leave an item out rather than infer it loosely.
- Fields marked support=household need a quote from a buyer. Something only the agent, a broker or anyone outside the household said is that person's own fact; it never becomes a buyer requirement.
- A limit given by a broker or the agent is their finance fact, not the buyers' ceiling, unless a buyer explicitly accepts it as their limit (then quote both).
- An item from the agent's playback or prompt counts only when a buyer explicitly confirms it. A buyer saying "maybe" is tentative: leave it out.
- Must-have = need/must/has to/non-negotiable/important. Deal-breaker = rules something out ("no...", "don't want...", "won't..."). Anything else wanted is a nice-to-have. "Not keen" is a preference, not a deal-breaker. Count each item once.
- Next actions need a commitment ("I'll...", "we'll...", or agreeing to a request) quoted from the person who owes it. "owners" holds speaker labels. "due" is as stated, or "not stated". Advice, open offers and private plans are not next actions.
- Areas come from the buyers (named, inspected, booked or bid). Areas only the agent suggested stay out. An area ruled out stays out.
- When a value changes during the call, suggest the LATER value and give the earlier one in conflict.earlier. When partners disagree, make one suggestion whose value says it is unresolved and list each person's view in conflict.views.
- Never suggest sensitive or subjective details (family planning, health, income, debts, the agent's personality notes). Keep only the resulting borrowing limit and timing the buyers state.
- Record a professional only when named and acting for the household, or the referrer. Leave "service" empty until the client chooses.
- Properties mentioned: outcome is "missed", "already seen" or "pursuing". Keep partial addresses partial.
- For a per-person field (work), set "subject" to that person's speaker label. Unlabelled agent notes use the label "notes (agent)".

The agreed fields (use only these ids):
"""


def _schema() -> dict[str, Any]:
    quote = {
        "type": "object",
        "properties": {"speaker": {"type": "string"}, "text": {"type": "string"}},
        "required": ["speaker", "text"], "additionalProperties": False,
    }
    nullable_str = {"type": ["string", "null"]}
    suggestion = {
        "type": "object",
        "properties": {
            "id": {"type": "string"},
            "field": {"type": "string", "enum": sorted(FIELDS)},
            "value": {"type": "string"},
            "basis": {"type": "string", "enum": ["stated", "inferred"]},
            "quotes": {"type": "array", "items": quote},
            "subject": nullable_str, "due": nullable_str, "outcome": nullable_str,
            "owners": {"type": ["array", "null"], "items": {"type": "string"}},
            "conflict": {
                "type": ["object", "null"],
                "properties": {
                    "type": {"type": "string", "enum": ["superseded", "disagreement"]},
                    "earlier": {
                        "type": ["object", "null"],
                        "properties": {"value": {"type": "string"}, "quotes": {"type": "array", "items": quote}},
                        "required": ["value", "quotes"], "additionalProperties": False,
                    },
                    "views": {
                        "type": ["array", "null"],
                        "items": {
                            "type": "object",
                            "properties": {"person": {"type": "string"}, "value": {"type": "string"}, "quote": quote},
                            "required": ["person", "value", "quote"], "additionalProperties": False,
                        },
                    },
                },
                "required": ["type", "earlier", "views"], "additionalProperties": False,
            },
        },
        "required": ["id", "field", "value", "basis", "quotes", "subject", "due", "outcome", "owners", "conflict"],
        "additionalProperties": False,
    }
    return {
        "type": "object",
        "properties": {"suggestions": {"type": "array", "items": suggestion}},
        "required": ["suggestions"], "additionalProperties": False,
    }


def _system_prompt() -> str:
    lines = [f"- {f.id}: {f.label} (support={f.support}, {f.kind})" for f in FIELDS.values()]
    return _SYSTEM + "\n".join(lines)


def _clean(s: dict[str, Any]) -> dict[str, Any]:
    """Drop the nulls the schema forces, so the suggestion matches the contract the app checks."""
    out = {k: v for k, v in s.items() if v is not None}
    c = out.get("conflict")
    if c:
        out["conflict"] = {k: v for k, v in c.items() if v is not None}
    return out


class ClaudeExtractor:
    def __init__(self, model: str, *, client: Any | None = None, ledger: SpendLedger | None = None) -> None:
        price_of(model)
        self.name = model
        self._model = model
        self._ledger = ledger or SpendLedger()
        if client is None:
            import anthropic

            client = anthropic.Anthropic()  # credentials come from the environment, read by the SDK
        self._client: Any = client
        self.last_usage: dict[str, float] = {}

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]:
        transcript = "\n".join(f"[{t['n']}] {t['speaker']}: {t['text']}" for t in request.turns)
        self._ledger.reserve(estimate_cost(self._model, [len(transcript)]))
        started = time.monotonic()
        response = self._client.messages.create(
            model=self._model,
            max_tokens=MAX_TOKENS,
            system=_system_prompt(),
            output_config={"effort": "medium", "format": {"type": "json_schema", "schema": _schema()}},
            messages=[{
                "role": "user",
                "content": "Transcript (each line is one turn: [number] speaker label: text):\n\n" + transcript,
            }],
        )
        pin, pout = price_of(self._model)
        usd = response.usage.input_tokens * pin / 1e6 + response.usage.output_tokens * pout / 1e6
        self._ledger.record(self._model, usd, "extraction")
        self.last_usage = {
            "input_tokens": float(response.usage.input_tokens), "output_tokens": float(response.usage.output_tokens),
            "usd": usd, "seconds": time.monotonic() - started,
        }
        if response.stop_reason in ("refusal", "max_tokens"):
            raise ExtractionError(f"The model stopped with {response.stop_reason}; no suggestions were used.")
        text = next((b.text for b in response.content if b.type == "text"), "")
        try:
            suggestions = json.loads(text)["suggestions"]
        except (ValueError, KeyError) as bad:
            raise ExtractionError("The model's answer was not the agreed JSON.") from bad
        return [_clean(s) for s in suggestions]
