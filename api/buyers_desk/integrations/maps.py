"""Maps: where a place is and how long it takes to drive between two. The synthetic adapter knows only
suburb centres, so every position says its precision is a suburb; drive times are estimates."""
from math import asin, cos, radians, sin, sqrt
from typing import Protocol, runtime_checkable

from buyers_desk.integrations.models import DriveTime, GeoResult, IntegrationInfo


@runtime_checkable
class MapsPort(Protocol):
    def info(self) -> IntegrationInfo: ...
    def geocode(self, address_line: str | None, suburb: str | None) -> GeoResult | None: ...
    def drive_time(self, from_place: str, to_place: str) -> DriveTime: ...


# Approximate suburb centres (latitude, longitude).
_SUBURBS = {
    "kedron": (-27.4195, 153.0316), "chermside": (-27.3860, 153.0330), "stafford": (-27.4066, 153.0108),
    "nundah": (-27.4010, 153.0610), "wavell heights": (-27.3900, 153.0480), "aspley": (-27.3620, 153.0150),
    "geebung": (-27.3700, 153.0510), "zillmere": (-27.3560, 153.0420), "bracken ridge": (-27.3200, 153.0360),
    "indooroopilly": (-27.5000, 152.9740), "toowong": (-27.4850, 152.9870), "taringa": (-27.4930, 152.9800),
    "wynnum": (-27.4430, 153.1700), "manly": (-27.4540, 153.1850), "wellington point": (-27.4800, 153.2350),
    "carina": (-27.4930, 153.0900), "holland park": (-27.5190, 153.0540), "mansfield": (-27.5300, 153.0900),
    "ipswich": (-27.6140, 152.7600), "logan": (-27.6400, 153.1100), "brisbane city": (-27.4700, 153.0260),
}


def _km(a: tuple[float, float], b: tuple[float, float]) -> float:
    (la1, lo1), (la2, lo2) = a, b
    p1, p2 = radians(la1), radians(la2)
    h = sin((p2 - p1) / 2) ** 2 + cos(p1) * cos(p2) * sin(radians(lo2 - lo1) / 2) ** 2
    return 2 * 6371 * asin(sqrt(h))


class SyntheticMaps:
    SOURCE = "synthetic maps (suburb centres only)"

    def info(self) -> IntegrationInfo:
        return IntegrationInfo(
            port="maps", adapter="synthetic maps", synthetic=True, live=False,
            description="Synthetic maps: suburb-centre positions and estimated drive times. No mapping provider is selected or connected.",
        )

    def geocode(self, address_line: str | None, suburb: str | None) -> GeoResult | None:
        centre = _SUBURBS.get((suburb or "").strip().lower())
        if centre is None:
            return None
        return GeoResult(lat=centre[0], lng=centre[1], precision="suburb", source=self.SOURCE, synthetic=True)

    def drive_time(self, from_place: str, to_place: str) -> DriveTime:
        a, b = _SUBURBS.get(from_place.strip().lower()), _SUBURBS.get(to_place.strip().lower())
        minutes = None if a is None or b is None else round(3 + _km(a, b) * 1.35 / 38 * 60)
        return DriveTime(from_place=from_place, to_place=to_place, minutes=minutes, source=self.SOURCE, synthetic=True)
