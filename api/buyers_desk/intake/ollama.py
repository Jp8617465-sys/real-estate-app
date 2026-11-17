"""A local model behind the extraction port, through Ollama (https://ollama.com).

Runs on the agent's own machine: no key, no spend, and nothing leaves it. Install Ollama, then
`ollama pull qwen3.5:9b` and keep it running. Same prompt and JSON schema as the Claude adapter.
"""
import time
from typing import Any

import httpx2 as httpx

from buyers_desk.intake.claude import ExtractionError, _clean, _schema, _system_prompt
from buyers_desk.intake.extraction import ExtractionRequest

DEFAULT_MODEL = "qwen3.5:9b"
DEFAULT_URL = "http://127.0.0.1:11434"


class OllamaExtractor:
    def __init__(
        self, model: str = DEFAULT_MODEL, *, url: str = DEFAULT_URL, transport: httpx.BaseTransport | None = None
    ) -> None:
        self.name = model
        self._url = url.rstrip("/")
        self._http = httpx.Client(transport=transport, timeout=httpx.Timeout(900.0, connect=5.0))
        self.last_usage: dict[str, float] = {}

    def extract(self, request: ExtractionRequest) -> list[dict[str, Any]]:
        transcript = "\n".join(f"[{t['n']}] {t['speaker']}: {t['text']}" for t in request.turns)
        started = time.monotonic()
        try:
            response = self._http.post(
                f"{self._url}/api/chat",
                json={
                    "model": self.name, "stream": False, "format": _schema(),
                    "options": {"temperature": 0, "num_ctx": 32768},
                    "messages": [
                        {"role": "system", "content": _system_prompt()},
                        {"role": "user", "content": "Transcript (each line is one turn: [number] speaker label: text):\n\n" + transcript},
                    ],
                },
            )
        except httpx.TransportError as down:
            raise ExtractionError(f"Could not reach ollama at {self._url}. Start it and `ollama pull {self.name}`.") from down
        if response.status_code != 200:
            raise ExtractionError(f"ollama answered {response.status_code}: {response.text[:200]}")
        body = response.json()
        self.last_usage = {
            "input_tokens": float(body.get("prompt_eval_count", 0)), "output_tokens": float(body.get("eval_count", 0)),
            "usd": 0.0, "seconds": time.monotonic() - started,
        }
        try:
            import json

            suggestions = json.loads(body["message"]["content"])["suggestions"]
        except (ValueError, KeyError, TypeError) as bad:
            raise ExtractionError("The local model's answer was not the agreed JSON.") from bad
        return [_clean(s) for s in suggestions]
