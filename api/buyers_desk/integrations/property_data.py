"""Property data: facts about a property, each with when the source observed it, when we retrieved
it, and whether it is stale. Missing facts are listed, never invented. The provider is not selected;
source data is not assumed redistributable, so adapters declare their terms."""
from collections.abc import Callable
from datetime import UTC, date, datetime, timedelta
from typing import Any, Protocol, runtime_checkable

from buyers_desk.integrations.models import Fact, IntegrationInfo, PropertyRecord

STALE_AFTER_DAYS = 180


@runtime_checkable
class PropertyDataPort(Protocol):
    def info(self) -> IntegrationInfo: ...
    def lookup(self, address_line: str, suburb: str | None) -> PropertyRecord | None: ...
    def comparables(self, suburb: str, bedrooms: int | None = None, limit: int = 5) -> list[PropertyRecord]: ...


_FIELDS = ("property_type", "bedrooms", "bathrooms", "parking", "land_m2", "price_guide_low", "price_guide_high", "last_sale_price", "last_sale_date")

# Invented properties on real suburb names. (suburb, address, postcode, facts) where a fact is (value, observed_at).
_D = date
_DATA: list[tuple[str, str, str, dict[str, tuple[Any, date]]]] = [
    ("Kedron", "12 Example St", "4031", {"property_type": ("Townhouse", _D(2026, 10, 1)), "bedrooms": (3, _D(2026, 10, 1)), "bathrooms": (2, _D(2026, 10, 1)), "parking": (2, _D(2026, 10, 1)), "land_m2": (210, _D(2026, 10, 1)), "price_guide_low": (850_000, _D(2026, 10, 20)), "price_guide_high": (900_000, _D(2026, 10, 20)), "last_sale_price": (640_000, _D(2026, 8, 2))}),
    ("Kedron", "3 Sample Lane", "4031", {"property_type": ("House", _D(2026, 9, 10)), "bedrooms": (3, _D(2026, 9, 10)), "bathrooms": (1, _D(2026, 9, 10)), "parking": (1, _D(2026, 9, 10)), "land_m2": (405, _D(2026, 9, 10)), "price_guide_low": (1_050_000, _D(2026, 9, 12)), "price_guide_high": (1_150_000, _D(2026, 9, 12))}),
    ("Kedron", "8 Placeholder Pde", "4031", {"property_type": ("Townhouse", _D(2026, 10, 5)), "bedrooms": (2, _D(2026, 10, 5)), "bathrooms": (2, _D(2026, 10, 5)), "parking": (1, _D(2026, 10, 5)), "price_guide_low": (720_000, _D(2026, 10, 6))}),
    ("Nundah", "9 Sample Ave", "4012", {"property_type": ("Unit", _D(2026, 10, 15)), "bedrooms": (2, _D(2026, 10, 15)), "bathrooms": (1, _D(2026, 10, 15)), "parking": (1, _D(2026, 10, 15)), "price_guide_low": (610_000, _D(2026, 10, 15)), "last_sale_price": (480_000, _D(2025, 11, 3))}),
    ("Stafford", "21 Demo Cres", "4053", {"property_type": ("House", _D(2026, 8, 20)), "bedrooms": (4, _D(2026, 8, 20)), "bathrooms": (2, _D(2026, 8, 20)), "parking": (2, _D(2026, 8, 20)), "land_m2": (607, _D(2026, 8, 20)), "price_guide_low": (1_250_000, _D(2026, 8, 25))}),
    ("Chermside", "5 Fixture Ct", "4032", {"property_type": ("Townhouse", _D(2026, 11, 1)), "bedrooms": (3, _D(2026, 11, 1)), "bathrooms": (2, _D(2026, 11, 1)), "parking": (2, _D(2026, 11, 1)), "price_guide_low": (780_000, _D(2026, 11, 2)), "price_guide_high": (830_000, _D(2026, 11, 2))}),
    ("Wavell Heights", "17 Mock Rd", "4012", {"property_type": ("House", _D(2026, 9, 28)), "bedrooms": (3, _D(2026, 9, 28)), "bathrooms": (2, _D(2026, 9, 28)), "land_m2": (550, _D(2026, 9, 28)), "price_guide_low": (990_000, _D(2026, 10, 2))}),
]


class SyntheticPropertyData:
    TERMS = "Synthetic: invented demonstration data on real suburb names. Not a real listing or valuation."

    def __init__(self, clock: Callable[[], date] = date.today) -> None:
        self._clock = clock

    def info(self) -> IntegrationInfo:
        return IntegrationInfo(
            port="property_data", adapter="synthetic property data", synthetic=True, live=False,
            description="Synthetic demonstration data. No provider is selected, contracted or connected.",
        )

    def _record(self, row: tuple[str, str, str, dict[str, tuple[Any, date]]]) -> PropertyRecord:
        suburb, address, postcode, raw = row
        now = datetime.now(UTC)
        today = self._clock()
        facts: dict[str, Fact] = {}
        for name, (value, observed) in raw.items():
            facts[name] = Fact(
                value=value, observed_at=observed, retrieved_at=now, source="synthetic property data",
                stale=today - observed > timedelta(days=STALE_AFTER_DAYS),
            )
        return PropertyRecord(
            address_line=address, suburb=suburb, state="QLD", postcode=postcode, facts=facts,
            missing=[f for f in _FIELDS if f not in facts], stale=[n for n, f in facts.items() if f.stale],
            synthetic=True, terms=self.TERMS,
        )

    def lookup(self, address_line: str, suburb: str | None) -> PropertyRecord | None:
        for row in _DATA:
            if row[1].lower() == address_line.strip().lower() and (suburb is None or row[0].lower() == suburb.strip().lower()):
                return self._record(row)
        return None

    def comparables(self, suburb: str, bedrooms: int | None = None, limit: int = 5) -> list[PropertyRecord]:
        found = [
            self._record(r) for r in _DATA
            if r[0].lower() == suburb.strip().lower() and (bedrooms is None or r[3].get("bedrooms", (None,))[0] == bedrooms)
        ]
        return found[:limit]
