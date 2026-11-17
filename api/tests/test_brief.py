"""Slice 3: the buyer brief, editable by hand. Every value keeps its source and history, whether
it came from a call or was typed in. Observed through the HTTP API; synthetic material only."""
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import decided, finish, new_opportunity, open_review_03


def brief(client: TestClient, engagement_id: str) -> dict[str, Any]:
    body: dict[str, Any] = client.get(f"/api/engagements/{engagement_id}/brief").json()
    return body


def field(client: TestClient, engagement_id: str, field_id: str) -> dict[str, Any]:
    for section in brief(client, engagement_id)["sections"]:
        for f in section["fields"]:
            if f["id"] == field_id:
                found: dict[str, Any] = f
                return found
    raise AssertionError(field_id)


def test_the_brief_lists_every_field_and_says_what_is_not_covered(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    body = brief(client, engagement_id)

    assert [s["key"] for s in body["sections"]] == ["profile", "brief", "intake"]
    assert field(client, engagement_id, "bedrooms")["values"] == []
    assert "Bedrooms" in body["not_covered"]
    budget = field(client, engagement_id, "budgetTarget")["values"]
    assert [(v["value"], v["source"]) for v in budget] == [("$950k", "Entered by hand")]  # the opportunity's budget
    assert "Budget target" not in body["not_covered"]


def test_a_single_value_field_is_set_then_replaced_and_keeps_its_history(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    first = client.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "3"})
    second = client.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "3, or 2 plus a study"})

    assert first.status_code == 200 and second.status_code == 200
    values = field(client, engagement_id, "bedrooms")["values"]
    assert [v["value"] for v in values] == ["3, or 2 plus a study"]
    assert [(h["value"], h["source"]) for h in values[0]["history"]] == [("3", "Entered by hand")]
    log = [c for c in client.get(f"/api/engagements/{engagement_id}/changes").json() if c["field"] == "bedrooms"]
    assert [(c["earlier_value"], c["new_value"]) for c in log] == [(None, "3"), ("3", "3, or 2 plus a study")]
    assert all(c["source"]["kind"] == "entered_by_hand" and c["changed_by"] == "Local agent" for c in log)


def test_a_many_value_field_takes_added_values_and_retires_them_individually(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    for item in ("Gympie Road", "Flooding"):
        assert client.post(f"/api/engagements/{engagement_id}/brief/dealBreakers/values", json={"value": item}).status_code == 201

    values = field(client, engagement_id, "dealBreakers")["values"]
    assert [v["value"] for v in values] == ["Gympie Road", "Flooding"]

    removed = client.delete(f"/api/engagements/{engagement_id}/brief/values/{values[0]['id']}")
    assert removed.status_code == 200
    assert [v["value"] for v in field(client, engagement_id, "dealBreakers")["values"]] == ["Flooding"]
    log = [c["new_value"] for c in client.get(f"/api/engagements/{engagement_id}/changes").json() if c["field"] == "dealBreakers"]
    assert log == ["Gympie Road", "Flooding", None]  # the removal is in the history, not erased


def test_the_wrong_kind_of_edit_or_an_unknown_field_is_refused(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    assert client.put(f"/api/engagements/{engagement_id}/brief/dealBreakers", json={"value": "x"}).status_code == 422
    assert client.post(f"/api/engagements/{engagement_id}/brief/bedrooms/values", json={"value": "x"}).status_code == 422
    assert client.put(f"/api/engagements/{engagement_id}/brief/nonsense", json={"value": "x"}).status_code == 404
    assert client.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "  "}).status_code == 422


def test_a_per_person_value_such_as_work_is_kept_for_each_person(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    client.put(f"/api/engagements/{engagement_id}/brief/work", json={"value": "Electrician", "subject": "Rhys"})
    client.put(f"/api/engagements/{engagement_id}/brief/work", json={"value": "ICU shifts", "subject": "Tash"})
    client.put(f"/api/engagements/{engagement_id}/brief/work", json={"value": "Commercial electrician", "subject": "Rhys"})

    values = {v["subject"]: v["value"] for v in field(client, engagement_id, "work")["values"]}

    assert values == {"Rhys": "Commercial electrician", "Tash": "ICU shifts"}


def test_setting_the_budget_target_keeps_the_engagements_budget_in_step(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    client.put(f"/api/engagements/{engagement_id}/brief/budgetTarget", json={"value": "$900k"})

    assert client.get(f"/api/engagements/{engagement_id}").json()["budget_aud"] == 900_000
    values = field(client, engagement_id, "budgetTarget")["values"]
    assert [v["value"] for v in values] == ["$900k"]
    assert values[0]["history"][0]["value"] == "$950k"


def test_a_manual_edit_replaces_a_value_from_a_call_and_the_history_keeps_the_calls_source(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")
    finish(client, intake_id)
    assert field(client, engagement_id, "pets")["values"][0]["value"] == "A cat"

    client.put(f"/api/engagements/{engagement_id}/brief/pets", json={"value": "A cat and a dog"})

    value = field(client, engagement_id, "pets")["values"][0]
    assert value["value"] == "A cat and a dog" and value["source"] == "Entered by hand"
    assert value["history"][0]["value"] == "A cat"
    assert "03-broker-joins-first-home-north" in value["history"][0]["source"]


def test_the_brief_belongs_to_its_agency_and_survives_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    engagement_id = new_opportunity(first)
    first.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "3"})

    assert field(app_client(), engagement_id, "bedrooms")["values"][0]["value"] == "3"
    elsewhere = app_client(another_agency)
    assert elsewhere.get(f"/api/engagements/{engagement_id}/brief").status_code == 404
    assert elsewhere.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "9"}).status_code == 404
