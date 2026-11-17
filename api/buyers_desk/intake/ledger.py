"""A local spend ledger. It holds the agreed US$50 total across every paid run, on this machine."""
import json
from datetime import UTC, datetime
from pathlib import Path

CAP_USD = 50.0
DEFAULT_PATH = Path(__file__).resolve().parents[2] / ".spend-ledger.json"  # api/, git-ignored


class LedgerCapExceeded(Exception):
    pass


class SpendLedger:
    def __init__(self, path: Path | None = None, cap: float = CAP_USD) -> None:
        self.path = path or DEFAULT_PATH
        self.cap = cap

    def _entries(self) -> list[dict[str, object]]:
        if not self.path.exists():
            return []
        data: list[dict[str, object]] = json.loads(self.path.read_text(encoding="utf-8"))
        return data

    @property
    def total(self) -> float:
        return sum(float(str(e["usd"])) for e in self._entries())

    def reserve(self, estimate: float) -> None:
        """Refuse a run that could take the total past the cap. Raises before any call is made."""
        if self.total + estimate > self.cap:
            raise LedgerCapExceeded(
                f"Refused: US${self.total:.2f} is already spent and this would add about US${estimate:.2f}, "
                f"past the US${self.cap:.0f} total."
            )

    def record(self, model: str, usd: float, note: str) -> None:
        entries = self._entries()
        entries.append({"when": datetime.now(UTC).isoformat(), "model": model, "usd": usd, "note": note})
        self.path.write_text(json.dumps(entries, indent=1) + "\n", encoding="utf-8")
