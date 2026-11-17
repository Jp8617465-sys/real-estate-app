"""The integrations the app runs with. Swap an adapter here, or inject others into create_app."""
from dataclasses import dataclass, field

from buyers_desk.integrations.identity import IdentityCheckPort, SyntheticIdentityCheck
from buyers_desk.integrations.mail_calendar import MailCalendarPort, SyntheticMailCalendar
from buyers_desk.integrations.maps import MapsPort, SyntheticMaps
from buyers_desk.integrations.models import IntegrationInfo
from buyers_desk.integrations.property_data import PropertyDataPort, SyntheticPropertyData


@dataclass
class Integrations:
    property_data: PropertyDataPort = field(default_factory=SyntheticPropertyData)
    maps: MapsPort = field(default_factory=SyntheticMaps)
    mail_calendar: MailCalendarPort = field(default_factory=SyntheticMailCalendar)
    identity: IdentityCheckPort = field(default_factory=SyntheticIdentityCheck)

    def describe(self) -> list[IntegrationInfo]:
        return [p.info() for p in (self.property_data, self.maps, self.mail_calendar, self.identity)]
