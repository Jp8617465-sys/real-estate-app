"""Slice 8 through the product API: the ports as the app uses them. Synthetic adapters only; each
result says so. Observed over HTTP; synthetic material only."""
from datetime import date, timedelta
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import new_opportunity

V1 = "/api/v1"


def test_the_integrations_endpoint_says_what_is_connected_and_nothing_is_live(client: TestClient) -> None:
    listed = client.get(f"{V1}/integrations").json()

    assert {i["port"] for i in listed} == {"property_data", "maps", "mail_calendar", "identity_check"}
    assert all(i["synthetic"] is True and i["live"] is False for i in listed)


def test_a_property_lookup_returns_facts_with_freshness_and_an_unknown_address_is_404(client: TestClient) -> None:
    found = client.post(f"{V1}/integrations/property-data/lookup", json={"address_line": "12 Example St", "suburb": "Kedron"})
    unknown = client.post(f"{V1}/integrations/property-data/lookup", json={"address_line": "1 Nowhere Rd", "suburb": "Atlantis"})

    assert found.status_code == 200 and found.json()["facts"]["bedrooms"]["value"] == 3
    assert found.json()["synthetic"] is True and "observed_at" in found.json()["facts"]["bedrooms"]
    assert unknown.status_code == 404
    comps = client.get(f"{V1}/integrations/property-data/comparables", params={"suburb": "Kedron", "bedrooms": 3}).json()
    assert comps and all(c["suburb"] == "Kedron" for c in comps)


def test_enriching_a_property_fills_only_what_was_empty_and_never_overwrites_what_was_entered(client: TestClient) -> None:
    prop = client.post(f"{V1}/properties", json={"address_line": "12 Example St", "suburb": "Kedron", "price_guide_low": 800_000}).json()

    done = client.post(f"{V1}/properties/{prop['id']}/enrich")

    assert done.status_code == 200
    body = done.json()
    assert "bedrooms" in body["filled"] and "price_guide_low" in body["kept"]
    assert body["property"]["bedrooms"] == 3 and body["property"]["price_guide_low"] == 800_000
    assert "synthetic property data" in body["property"]["source"]
    assert body["property"]["address_line"] == "12 Example St"
    nothing = client.post(f"{V1}/properties", json={"address_line": "99 Unlisted St", "suburb": "Kedron"}).json()
    assert client.post(f"{V1}/properties/{nothing['id']}/enrich").status_code == 404


def test_maps_geocode_and_drive_time_are_estimates_and_say_so(client: TestClient) -> None:
    drive = client.get(f"{V1}/integrations/maps/drive-time", params={"from_place": "Kedron", "to_place": "Chermside"}).json()
    geo = client.get(f"{V1}/integrations/maps/geocode", params={"suburb": "Kedron"}).json()

    assert drive["minutes"] is not None and drive["synthetic"] is True
    assert geo["precision"] == "suburb"
    assert client.get(f"{V1}/integrations/maps/geocode", params={"suburb": "Atlantis"}).status_code == 404
    assert client.get(f"{V1}/integrations/maps/drive-time", params={"from_place": "Kedron", "to_place": "Atlantis"}).json()["minutes"] is None


def test_discovery_call_slots_are_proposed_for_the_clients_and_booking_moves_the_stage_and_makes_a_task(client: TestClient) -> None:
    engagement_id = new_opportunity(client, {"household_name": "Ada (synthetic)", "client": {"name": "Ada Lovelace", "email": "ada@example.com"}})

    slots = client.post(f"{V1}/engagements/{engagement_id}/discovery-call/slots").json()
    assert len(slots["slots"]) == 6 and slots["attendees"] == ["ada@example.com"]
    first = slots["slots"][0]["start"]
    assert first[:10] >= (date.today() + timedelta(days=1)).isoformat()

    booked = client.post(f"{V1}/engagements/{engagement_id}/discovery-call/book", json={"start": first})

    assert booked.status_code == 201
    body = booked.json()
    assert "mailto:ada@example.com" in body["invite_ics"] and "SUMMARY:Discovery call: Ada (synthetic)" in body["invite_ics"]
    assert body["stage"] == "consultation" and body["synthetic"] is True
    assert client.get(f"{V1}/engagements/{engagement_id}").json()["stage"] == "consultation"
    tasks = client.get(f"{V1}/tasks", params={"engagement_id": engagement_id}).json()
    assert [t["title"] for t in tasks] == ["Discovery call: Ada (synthetic)"] and tasks[0]["due_on"] == first[:10]
    comms = client.get(f"{V1}/engagements/{engagement_id}/communications").json()
    assert comms[0]["direction"] == "out" and "Invitation" in comms[0]["subject"]
    assert client.post(f"{V1}/engagements/{engagement_id}/discovery-call/book", json={"start": "soon"}).status_code == 422


def test_communications_are_logged_per_engagement_and_appear_on_the_timeline(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    logged = client.post(
        f"{V1}/engagements/{engagement_id}/communications",
        json={"direction": "in", "channel": "email", "subject": "Can we move Saturday?", "body": "Hi, could we move it to 10am?"},
    )

    assert logged.status_code == 201 and logged.json()["subject"] == "Can we move Saturday?"
    assert [c["subject"] for c in client.get(f"{V1}/engagements/{engagement_id}/communications").json()] == ["Can we move Saturday?"]
    titles = [e["title"] for e in client.get(f"{V1}/engagements/{engagement_id}/timeline").json()]
    assert "Email received: Can we move Saturday?" in titles
    assert client.post(f"{V1}/engagements/{engagement_id}/communications", json={"direction": "in", "channel": "carrier pigeon", "subject": "x"}).status_code == 422


def test_an_identity_check_is_run_stored_and_labelled_synthetic(client: TestClient) -> None:
    ada = client.post(f"{V1}/people", json={"name": "Ada Lovelace", "mobile": "0400 111 222"}).json()
    fail = client.post(f"{V1}/people", json={"name": "Fail Case", "mobile": "0400 333 444"}).json()

    ran = client.post(f"{V1}/people/{ada['id']}/identity-checks", json={"kind": "customer_identification"})
    bad = client.post(f"{V1}/people/{fail['id']}/identity-checks", json={"kind": "customer_identification"})

    assert ran.status_code == 201 and ran.json()["status"] == "passed" and ran.json()["synthetic"] is True
    assert bad.json()["status"] == "failed"
    stored = client.get(f"{V1}/people/{ada['id']}/identity-checks").json()
    assert [(c["kind"], c["status"], c["provider"]) for c in stored] == [("customer_identification", "passed", "synthetic")]
    assert stored[0]["evidence"] and stored[0]["reference"].startswith("SYN-")
    assert client.post(f"{V1}/people/{ada['id']}/identity-checks", json={"kind": "mind_reading"}).status_code == 422


def test_logs_and_checks_belong_to_their_agency_and_survive_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    engagement_id = new_opportunity(first)
    first.post(f"{V1}/engagements/{engagement_id}/communications", json={"direction": "out", "channel": "note", "subject": "Hello"})
    ada = first.post(f"{V1}/people", json={"name": "Ada", "mobile": "0400 111 222"}).json()
    first.post(f"{V1}/people/{ada['id']}/identity-checks", json={"kind": "sanctions_pep"})

    again = app_client()
    assert len(again.get(f"{V1}/engagements/{engagement_id}/communications").json()) == 1
    assert len(again.get(f"{V1}/people/{ada['id']}/identity-checks").json()) == 1
    elsewhere = app_client(another_agency)
    assert elsewhere.get(f"{V1}/engagements/{engagement_id}/communications").status_code == 404
    assert elsewhere.get(f"{V1}/people/{ada['id']}/identity-checks").status_code == 404
