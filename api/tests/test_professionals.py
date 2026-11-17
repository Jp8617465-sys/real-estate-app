"""Slice 5: an agency-wide directory of professionals (brokers, selling agents, conveyancers,
inspectors, referrers), linked to engagements with a role. One person is one record, whether a
client, a professional or both. Observed through the HTTP API; synthetic material only."""
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import decided, finish, new_opportunity, open_review_03


def pro(client: TestClient, name: str, kind: str = "broker", **extra: Any) -> dict[str, Any]:
    response = client.post("/api/professionals", json={"name": name, "kind": kind, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def directory(client: TestClient, **params: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = client.get("/api/professionals", params=params).json()
    return rows


def test_a_professional_is_created_found_by_name_or_firm_and_filtered_by_kind(client: TestClient) -> None:
    dan = pro(client, "Dan Broker", "broker", firm="Example Finance", email="dan@example.com")
    sue = pro(client, "Sue Seller", "selling_agent", firm="Example Realty")

    assert {p["id"] for p in directory(client)} == {dan["id"], sue["id"]}
    assert [p["id"] for p in directory(client, kind="broker")] == [dan["id"]]
    assert [p["id"] for p in directory(client, q="realty")] == [sue["id"]]
    assert [p["id"] for p in directory(client, q="dan")] == [dan["id"]]
    assert dan["firm"] == "Example Finance" and dan["kind"] == "broker"


def test_a_matching_email_or_mobile_is_refused_until_confirmed(client: TestClient) -> None:
    first = pro(client, "Dan Broker", mobile="0400 555 000")

    refused = client.post("/api/professionals", json={"name": "Dan B", "kind": "broker", "mobile": "+61 400 555 000"})

    assert refused.status_code == 409 and refused.json()["detail"]["matches"][0]["id"] == first["id"]
    assert len(directory(client)) == 1


def test_an_existing_client_can_also_be_a_professional_as_one_record(client: TestClient) -> None:
    person = client.post("/api/people", json={"name": "Bea Broker", "mobile": "0400 777 000"}).json()

    made = client.put(f"/api/professionals/{person['id']}", json={"kind": "broker", "firm": "Bea Finance"})

    assert made.status_code == 200 and made.json()["id"] == person["id"]
    assert [p["id"] for p in directory(client)] == [person["id"]]
    assert client.get(f"/api/people/{person['id']}").status_code == 200  # still a client record too
    assert len(client.get("/api/people").json()) == 1


def test_a_professional_is_edited_and_a_bad_kind_is_refused(client: TestClient) -> None:
    dan = pro(client, "Dan Broker")

    edited = client.patch(f"/api/professionals/{dan['id']}", json={"firm": "New Firm", "kind": "conveyancer", "notes": "Fast replies"})

    assert edited.status_code == 200
    assert (edited.json()["firm"], edited.json()["kind"], edited.json()["notes"]) == ("New Firm", "conveyancer", "Fast replies")
    assert client.patch(f"/api/professionals/{dan['id']}", json={"kind": "wizard"}).status_code == 422


def test_a_professional_is_linked_to_engagements_with_a_role_and_one_record_serves_them_all(client: TestClient) -> None:
    one = new_opportunity(client)
    two = new_opportunity(client, {"household_name": "B", "client": {"name": "B Client", "email": "b@example.com"}})
    dan = pro(client, "Dan Broker", firm="Example Finance")

    linked = client.post(f"/api/engagements/{one}/professionals", json={"person_id": dan["id"], "role": "Their mortgage broker"})
    again = client.post(f"/api/engagements/{one}/professionals", json={"person_id": dan["id"], "role": "x"})
    client.post(f"/api/engagements/{two}/professionals", json={"person_id": dan["id"], "role": "Broker"})

    assert linked.status_code == 201 and again.status_code == 409
    listed = client.get(f"/api/engagements/{one}/professionals").json()
    assert [(p["name"], p["role"], p["firm"]) for p in listed["current"]] == [("Dan Broker", "Their mortgage broker", "Example Finance")]
    detail = client.get(f"/api/professionals/{dan['id']}").json()
    assert sorted(e["role"] for e in detail["engagements"]) == ["Broker", "Their mortgage broker"]


def test_a_link_can_be_ended_and_the_professional_stays_in_the_history(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    dan = pro(client, "Dan Broker")
    client.post(f"/api/engagements/{engagement_id}/professionals", json={"person_id": dan["id"], "role": "Broker"})

    ended = client.post(f"/api/engagements/{engagement_id}/professionals/{dan['id']}/end")

    listed = client.get(f"/api/engagements/{engagement_id}/professionals").json()
    assert ended.status_code == 200 and listed["current"] == []
    assert [p["name"] for p in listed["former"]] == ["Dan Broker"]
    assert client.post(f"/api/engagements/{engagement_id}/professionals/{dan['id']}/end").status_code == 409


def test_a_professional_named_in_a_call_joins_the_directory_with_a_kind(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")
    finish(client, intake_id)

    found = directory(client, kind="broker")

    assert [p["name"] for p in found] == ["Dan"]
    listed = client.get(f"/api/engagements/{engagement_id}/professionals").json()
    assert [(p["name"], p["role"]) for p in listed["current"]] == [("Dan", "Mortgage broker")]


def test_the_directory_belongs_to_its_agency_and_survives_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    dan = pro(first, "Dan Broker")

    assert [p["id"] for p in directory(app_client())] == [dan["id"]]
    elsewhere = app_client(another_agency)
    assert directory(elsewhere) == [] and elsewhere.get(f"/api/professionals/{dan['id']}").status_code == 404
