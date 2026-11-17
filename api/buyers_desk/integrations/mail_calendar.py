"""Mail and calendar: propose times for a call and produce an invitation. The synthetic adapter has an
invented diary (Wednesday lunch is busy) and sends nothing."""
import uuid
from datetime import date, datetime, timedelta
from typing import Protocol, runtime_checkable
from zoneinfo import ZoneInfo

from buyers_desk.integrations.models import IntegrationInfo, Invite, Slot

BRISBANE = ZoneInfo("Australia/Brisbane")


@runtime_checkable
class MailCalendarPort(Protocol):
    def info(self) -> IntegrationInfo: ...
    def propose_slots(self, attendees: list[str], earliest: date, count: int = 6) -> list[Slot]: ...
    def create_invite(self, slot: Slot, attendees: list[str], title: str) -> Invite: ...


class SyntheticMailCalendar:
    def info(self) -> IntegrationInfo:
        return IntegrationInfo(
            port="mail_calendar", adapter="synthetic mail and calendar", synthetic=True, live=False,
            description="Synthetic diary and invitations. Nothing is sent; no mail or calendar account is connected.",
        )

    def propose_slots(self, attendees: list[str], earliest: date, count: int = 6) -> list[Slot]:
        slots: list[Slot] = []
        day = earliest
        while len(slots) < count:
            if day.weekday() < 5:
                for hour in range(9, 17):
                    if day.weekday() == 2 and hour == 12:
                        continue  # busy in the invented diary
                    start = datetime(day.year, day.month, day.day, hour, tzinfo=BRISBANE)
                    slots.append(Slot(start=start, end=start + timedelta(hours=1)))
                    if len(slots) == count:
                        break
            day += timedelta(days=1)
        return slots

    def create_invite(self, slot: Slot, attendees: list[str], title: str) -> Invite:
        uid = f"{uuid.uuid4()}@buyers-desk.synthetic"
        fmt = "%Y%m%dT%H%M%S"
        lines = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Buyers desk (synthetic)//EN", "BEGIN:VEVENT", f"UID:{uid}",
            f"DTSTAMP:{datetime.now(BRISBANE).strftime(fmt)}", f"DTSTART;TZID=Australia/Brisbane:{slot.start.strftime(fmt)}",
            f"DTEND;TZID=Australia/Brisbane:{slot.end.strftime(fmt)}", f"SUMMARY:{title}",
            *[f"ATTENDEE;RSVP=TRUE:mailto:{a}" for a in attendees], "END:VEVENT", "END:VCALENDAR",
        ]
        return Invite(uid=uid, ics="\r\n".join(lines) + "\r\n", slot=slot, attendees=attendees, synthetic=True)
