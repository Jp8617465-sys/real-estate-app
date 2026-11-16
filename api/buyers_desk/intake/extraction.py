"""The extraction port: transcript turns, the agreed field list and the record so far in; raw
suggestions out. Adapters are swappable: a scripted replay (tests, demos, no spend) and, from the
scoring ticket, the Claude API. Nothing the adapter returns is trusted: code checks every quote."""
import hashlib
import json
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Protocol

from buyers_desk.intake.fields import Field

REPLAYS = Path(__file__).resolve().parent / "replays"


@dataclass(frozen=True)
class ExtractionRequest:
    turns: Sequence[dict[str, Any]]
    fields: Sequence[Field]
    existing: dict[str, Any] = field(default_factory=dict)


class Extractor(Protocol):
    name: str

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]: ...


def fingerprint(turns: Sequence[dict[str, Any]]) -> str:
    """Identifies a transcript by what was said and by whom, whatever its file format."""
    body = "\n".join(f"{t['speaker']}\t{t['text']}" for t in turns)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


class ScriptedExtractor:
    """Replays recorded suggestions for the transcripts it knows; returns nothing for others."""

    name = "scripted replay"

    def __init__(
        self, directories: Sequence[Path] = (REPLAYS,), fallbacks: dict[str, list[dict[str, Any]]] | None = None
    ) -> None:
        """`fallbacks` (fingerprint -> suggestions) fill in only for transcripts with no recorded file."""
        self._replays: dict[str, list[dict[str, Any]]] = {}
        for directory in directories:
            for path in sorted(directory.glob("*.json")):
                data = json.loads(path.read_text(encoding="utf-8"))
                self._replays[data["fingerprint"]] = data["suggestions"]
        for print_, suggestions in (fallbacks or {}).items():
            self._replays.setdefault(print_, suggestions)

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]:
        found = self._replays.get(fingerprint(request.turns), [])
        copy: list[dict[str, Any]] = json.loads(json.dumps(found))  # a fresh copy each time
        return copy

    def knows(self, turns: Sequence[dict[str, Any]]) -> bool:
        return fingerprint(turns) in self._replays
