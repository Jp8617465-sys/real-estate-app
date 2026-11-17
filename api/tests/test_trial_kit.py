"""Slice 9: the trial kit. Seeding builds synthetic Buy Well-style data through the real API, refuses
to pile onto existing data, and feedback from the trial can be captured and read back."""
from typing import Any

from fastapi.testclient import TestClient

from buyers_desk.seed import AlreadyHasData, seed
from tests.conftest import ClientFactory

V1 = "/api/v1"


def get(client: TestClient, path: str, **params: Any) -> Any:
    response = client.get(f"{V1}{path}", params={"limit": 200, **params})
    assert response.status_code == 200, response.text
    return response.json()


def test_seeding_builds_a_realistic_synthetic_agency_through_the_api(client: TestClient) -> None:
    summary = seed(client)

    assert summary["households"] >= 6 and summary["people"] >= 9
    engagements = get(client, "/engagements")
    assert len(engagements) >= 6
    assert len({e["stage"] for e in engagements}) >= 5  # spread across the pipeline
    assert len(get(client, "/properties")) >= 8
    assert {p["kind"] for p in get(client, "/professionals")} >= {"broker", "selling_agent", "conveyancer"}
    tasks = get(client, "/tasks", state="open")
    assert any(t["overdue"] for t in tasks) and any(not t["overdue"] for t in tasks)
    assert all("example.com" in (p["email"] or "example.com") for p in get(client, "/people"))  # no real addresses


def test_seeding_includes_a_finished_discovery_call_with_its_recorded_values(client: TestClient) -> None:
    seed(client)

    calls = [e for e in get(client, "/engagements") if client.get(f"{V1}/engagements/{e['id']}/intakes").json()]
    assert len(calls) == 1
    intake = client.get(f"{V1}/engagements/{calls[0]['id']}/intakes").json()[0]
    assert intake["stage"] == "result"
    brief = client.get(f"{V1}/engagements/{calls[0]['id']}/brief").json()
    values = [v for s in brief["sections"] for f in s["fields"] for v in f["values"]]
    assert len(values) > 10
    assert any("03-broker-joins" in v["source"] for v in values)


def test_seeding_twice_is_refused_so_the_demo_never_doubles_up(client: TestClient) -> None:
    seed(client)
    before = len(get(client, "/people"))

    try:
        seed(client)
    except AlreadyHasData:
        pass
    else:
        raise AssertionError("a second seed should be refused")
    assert len(get(client, "/people")) == before


def test_feedback_is_captured_listed_newest_first_and_validated(client: TestClient) -> None:
    first = client.post(f"{V1}/feedback", json={"author": "Buy Well agent", "area": "Shortlist", "note": "Can I sort by price?"})
    client.post(f"{V1}/feedback", json={"author": "James", "area": "General", "note": "Looks good"})

    listed = client.get(f"{V1}/feedback").json()

    assert first.status_code == 201
    assert [f["note"] for f in listed] == ["Looks good", "Can I sort by price?"]
    assert listed[1]["area"] == "Shortlist" and listed[1]["author"] == "Buy Well agent" and listed[1]["created_at"]
    assert client.post(f"{V1}/feedback", json={"note": "  "}).status_code == 422


def test_feedback_belongs_to_its_agency_and_survives_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    app_client().post(f"{V1}/feedback", json={"note": "Kept"})

    assert [f["note"] for f in app_client().get(f"{V1}/feedback").json()] == ["Kept"]
    assert app_client(another_agency).get(f"{V1}/feedback").json() == []
