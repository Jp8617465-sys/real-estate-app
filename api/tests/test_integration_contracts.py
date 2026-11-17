"""Slice 8: integration ports. Every adapter, synthetic or real, must pass these contract tests, so a
provider can be swapped in without changing the app. Only synthetic adapters exist today, and
every result says so. No credentials, no network, no spend."""
from datetime import date, timedelta

import pytest

from buyers_desk.integrations.identity import IdentityCheckPort, SyntheticIdentityCheck
from buyers_desk.integrations.mail_calendar import MailCalendarPort, SyntheticMailCalendar
from buyers_desk.integrations.maps import MapsPort, SyntheticMaps
from buyers_desk.integrations.property_data import PropertyDataPort, SyntheticPropertyData

TODAY = date(2026, 11, 17)  # a Tuesday


@pytest.fixture(params=[lambda: SyntheticPropertyData(clock=lambda: TODAY)], ids=["synthetic"])
def property_data(request: pytest.FixtureRequest) -> PropertyDataPort:
    port: PropertyDataPort = request.param()
    return port


@pytest.fixture(params=[SyntheticMaps], ids=["synthetic"])
def maps(request: pytest.FixtureRequest) -> MapsPort:
    port: MapsPort = request.param()
    return port


@pytest.fixture(params=[SyntheticMailCalendar], ids=["synthetic"])
def calendar(request: pytest.FixtureRequest) -> MailCalendarPort:
    port: MailCalendarPort = request.param()
    return port


@pytest.fixture(params=[SyntheticIdentityCheck], ids=["synthetic"])
def identity(request: pytest.FixtureRequest) -> IdentityCheckPort:
    port: IdentityCheckPort = request.param()
    return port


# ---- Property data -------------------------------------------------------------------------------------------------


def test_a_property_lookup_returns_facts_each_with_when_the_source_observed_it(property_data: PropertyDataPort) -> None:
    record = property_data.lookup("12 Example St", "Kedron")

    assert record is not None and record.suburb == "Kedron" and record.synthetic is True
    bedrooms = record.facts["bedrooms"]
    assert bedrooms.value == 3 and bedrooms.observed_at is not None and bedrooms.retrieved_at is not None
    assert bedrooms.source


def test_retrieval_time_is_kept_apart_from_when_the_source_last_observed_the_fact(property_data: PropertyDataPort) -> None:
    record = property_data.lookup("12 Example St", "Kedron")

    assert record is not None
    fact = record.facts["price_guide_low"]
    assert fact.observed_at is not None and fact.retrieved_at.date() >= fact.observed_at
    assert fact.retrieved_at.tzinfo is not None


def test_missing_and_stale_facts_are_listed_not_hidden(property_data: PropertyDataPort) -> None:
    record = property_data.lookup("9 Sample Ave", "Nundah")

    assert record is not None
    assert "land_m2" in record.missing and "land_m2" not in record.facts
    assert "last_sale_price" in record.stale  # observed more than 180 days before the clock
    assert record.facts["last_sale_price"].stale is True and record.facts["bedrooms"].stale is False


def test_an_unknown_property_is_none_and_comparables_match_the_suburb_and_bedrooms(property_data: PropertyDataPort) -> None:
    assert property_data.lookup("1 Nowhere Rd", "Atlantis") is None
    comps = property_data.comparables("Kedron", bedrooms=3, limit=5)

    assert comps and all(c.suburb == "Kedron" and c.facts["bedrooms"].value == 3 for c in comps)
    assert len(property_data.comparables("Kedron", bedrooms=3, limit=1)) == 1


def test_property_data_declares_that_it_is_synthetic_and_its_terms(property_data: PropertyDataPort) -> None:
    info = property_data.info()

    assert info.synthetic is True and info.live is False and "synthetic" in info.description.lower()


# ---- Maps -------------------------------------------------------------------------------------------------------------


def test_geocoding_gives_a_position_with_its_precision_and_unknown_places_are_none(maps: MapsPort) -> None:
    kedron = maps.geocode("12 Example St", "Kedron")

    assert kedron is not None and kedron.precision == "suburb" and -28 < kedron.lat < -26 and 152 < kedron.lng < 154
    assert kedron.synthetic is True
    assert maps.geocode("1 Nowhere Rd", "Atlantis") is None


def test_drive_time_is_plausible_symmetric_and_unknown_when_a_place_is_unknown(maps: MapsPort) -> None:
    there = maps.drive_time("Kedron", "Chermside")
    back = maps.drive_time("Chermside", "Kedron")
    far = maps.drive_time("Kedron", "Ipswich")

    assert there.minutes is not None and 3 <= there.minutes <= 25 and there.minutes == back.minutes
    assert far.minutes is not None and far.minutes > there.minutes
    assert maps.drive_time("Kedron", "Atlantis").minutes is None
    assert there.synthetic is True


# ---- Mail and calendar ---------------------------------------------------------------------------------------------


def test_proposed_slots_are_weekday_business_hours_in_brisbane_and_avoid_busy_times(calendar: MailCalendarPort) -> None:
    slots = calendar.propose_slots(["a@example.com"], earliest=TODAY + timedelta(days=1), count=6)

    assert len(slots) == 6 and slots == sorted(slots, key=lambda s: s.start)
    for s in slots:
        assert s.start.weekday() < 5 and 9 <= s.start.hour < 17 and s.end - s.start == timedelta(hours=1)
        assert s.start.utcoffset() == timedelta(hours=10)
    assert not any(s.start.weekday() == 2 and s.start.hour == 12 for s in slots)  # Wednesday lunch is busy


def test_an_invite_lists_every_attendee_and_the_time(calendar: MailCalendarPort) -> None:
    slot = calendar.propose_slots(["a@example.com"], earliest=TODAY + timedelta(days=1), count=1)[0]

    invite = calendar.create_invite(slot, ["a@example.com", "b@example.com"], "Discovery call")

    assert invite.synthetic is True and invite.uid
    for needle in ("BEGIN:VCALENDAR", "BEGIN:VEVENT", "SUMMARY:Discovery call", "mailto:a@example.com", "mailto:b@example.com", "TZID=Australia/Brisbane", "END:VCALENDAR"):
        assert needle in invite.ics
    assert calendar.create_invite(slot, ["a@example.com"], "x").uid != invite.uid


# ---- Identity checks ------------------------------------------------------------------------------------------------


def test_an_identity_check_returns_a_status_a_reference_and_evidence_and_says_it_is_synthetic(identity: IdentityCheckPort) -> None:
    result = identity.start_check("Ada Lovelace", "customer_identification")

    assert result.status == "passed" and result.reference and result.evidence and result.synthetic is True
    assert result.kind == "customer_identification"


def test_checks_can_need_review_or_fail_and_the_reason_is_in_the_evidence(identity: IdentityCheckPort) -> None:
    assert identity.start_check("Refer Case", "sanctions_pep").status == "needs_review"
    failed = identity.start_check("Fail Case", "customer_identification")
    assert failed.status == "failed" and any("synthetic" in e.lower() for e in failed.evidence)
