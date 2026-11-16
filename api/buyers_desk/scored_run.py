"""Score an extractor against James's approved answer keys.

    cd api
    uv run python -m buyers_desk.scored_run --replay-keys              # no cost: checks the scorer
    uv run python -m buyers_desk.scored_run --model claude-sonnet-5-5   # asks first; needs a key
    uv run python -m buyers_desk.scored_run --ollama qwen3.5:9b        # local, free; needs Ollama running

The key is read from the environment by the Anthropic SDK (ANTHROPIC_API_KEY, or `ant auth login`).
Run each model once and compare the reports. A local ledger holds the US$50 total.
Synthetic material only.
"""
import argparse
import sys
import time
from collections.abc import Callable, Sequence
from pathlib import Path
from typing import Any

from buyers_desk.intake.claude import PRICES, ClaudeExtractor, ExtractionError, estimate_cost
from buyers_desk.intake.keys import load_keys
from buyers_desk.intake.ledger import LedgerCapExceeded, SpendLedger
from buyers_desk.intake.ollama import OllamaExtractor
from buyers_desk.intake.scoring import KeyReplayExtractor, Report, score_all


def main(
    argv: Sequence[str] | None = None,
    *,
    ask: Callable[[str], str] = input,
    client: Any | None = None,
    ledger_path: Path | None = None,
    ollama_transport: Any | None = None,
) -> int:
    parser = argparse.ArgumentParser(prog="scored_run", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model", choices=sorted(PRICES), help="a Claude model to run (spends money)")
    parser.add_argument("--ollama", metavar="MODEL", help="a local model served by Ollama (free), e.g. qwen3.5:9b")
    parser.add_argument("--replay-keys", action="store_true", help="replay the answer keys: free, checks the scorer")
    args = parser.parse_args(argv)
    keys = load_keys()

    if args.replay_keys:
        print(score_all(KeyReplayExtractor(keys), keys).render())
        return 0
    if args.ollama:
        return _run_local(args.ollama, keys, ollama_transport)
    if not args.model:
        parser.error("choose --model MODEL, --ollama MODEL or --replay-keys")

    ledger = SpendLedger(ledger_path)
    estimate = estimate_cost(args.model, [len(k.text) for k in keys])
    print(f"Estimated cost for {args.model} over {len(keys)} transcripts: US${estimate:.2f} (pessimistic). Spent so far: US${ledger.total:.2f} of US$50.")
    try:
        ledger.reserve(estimate)
    except LedgerCapExceeded as refusal:
        print(refusal)
        return 2
    if ask("Run it and spend that? [y/N] ").strip().lower() not in ("y", "yes"):
        print("Not run. Nothing was spent.")
        return 1

    extractor = ClaudeExtractor(args.model, client=client, ledger=ledger)
    totals = {"input_tokens": 0.0, "output_tokens": 0.0, "usd": 0.0, "seconds": 0.0}
    started = time.monotonic()

    class Metered:
        name = extractor.name

        def extract(self, request: Any) -> list[dict[str, Any]]:
            result = extractor.extract(request)
            for k in totals:
                totals[k] += extractor.last_usage.get(k, 0.0)
            return result

    try:
        report: Report = score_all(Metered(), keys)
    except (ExtractionError, LedgerCapExceeded) as stop:
        print(f"Stopped: {stop}")
        return 2
    totals["seconds"] = time.monotonic() - started
    report.usage = totals
    print(report.render())
    return 0 if report.passed else 1


def _run_local(model: str, keys: Sequence[Any], transport: Any | None) -> int:
    extractor = OllamaExtractor(model, transport=transport)
    totals = {"input_tokens": 0.0, "output_tokens": 0.0, "usd": 0.0, "seconds": 0.0}

    class Metered:
        name = extractor.name

        def extract(self, request: Any) -> list[dict[str, Any]]:
            result = extractor.extract(request)
            for k in totals:
                totals[k] += extractor.last_usage.get(k, 0.0)
            return result

    try:
        report = score_all(Metered(), keys)
    except ExtractionError as stop:
        print(f"Stopped: {stop}")
        return 2
    report.usage = totals
    print(report.render())
    return 0 if report.passed else 1


if __name__ == "__main__":
    sys.exit(main())
