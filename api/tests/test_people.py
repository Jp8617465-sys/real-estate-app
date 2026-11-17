"""Slice 1 of the Buy Well trial spec: clients and households.

A client is one person in dated households with typed relationships. Enquiries and edits that
match an existing person by email or mobile are refused until the agent confirms; nothing is
ever silently merged. Observed through the HTTP API; synthetic material only.
"""
from typing import Any
from uuid import uuid4

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory


def person(client: TestClient, name: str, **extra: Any) -> dict[str, Any]:
    response = client.post("/api/v1/people", json={"name": name, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def household(client: TestClient, name: str, *members: str) -> dict[str, Any]:
    response = client.post("/api/v1/households", json={"name": name, "member_ids": list(members)})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def test_a_person_is_found_by_name_email_or_mobile_however_the_mobile_is_written(client: TestClient) -> None:
    ada = person(client, "Ada Lovelace", email="ada@example.com", mobile="0400 111 222")
    person(client, "Grace Hopper", email="grace@example.com")

    def ids(q: str) -> list[str]:
        return [p["id"] for p in client.get("/api/v1/people", params={"q": q}).json()]

    assert ids("lovel") == [ada["id"]]
    assert ids("ADA@example") == [ada["id"]]
    assert ids("0400111222") == [ada["id"]]
    assert ids("+61 400 111 222") == [ada["id"]]
    assert ids("nobody") == []
    assert len(client.get("/api/v1/people").json()) == 2


def test_a_person_matching_an_existing_email_or_mobile_is_refused_until_confirmed_and_never_merged(
    client: TestClient,
) -> None:
    first = person(client, "Ada Lovelace", email="ada@example.com", mobile="0400 111 222")

    by_mobile = client.post("/api/v1/people", json={"name": "Ada L", "mobile": "0400111222"})
    by_email = client.post("/api/v1/people", json={"name": "Ada L", "email": "ADA@example.com"})

    for refused in (by_mobile, by_email):
        assert refused.status_code == 409
        assert [m["id"] for m in refused.json()["detail"]["matches"]] == [first["id"]]
    assert len(client.get("/api/v1/people").json()) == 1  # nothing was saved

    confirmed = client.post(
        "/api/v1/people", json={"name": "Ada L", "mobile": "0400111222", "confirm_duplicate": True}
    )
    assert confirmed.status_code == 201
    assert confirmed.json()["id"] != first["id"]  # a second person: never silently merged
    assert len(client.get("/api/v1/people").json()) == 2


def test_editing_a_person_logs_the_earlier_value_and_a_clashing_edit_needs_confirming(
    client: TestClient,
) -> None:
    ada = person(client, "Ada Lovelace", email="ada@example.com")
    grace = person(client, "Grace Hopper", email="grace@example.com")

    edited = client.patch(f"/api/v1/people/{ada['id']}", json={"mobile": "0400 111 222", "name": "Ada King"})
    clash = client.patch(f"/api/v1/people/{ada['id']}", json={"email": "grace@example.com"})

    assert edited.status_code == 200 and edited.json()["name"] == "Ada King"
    assert clash.status_code == 409 and clash.json()["detail"]["matches"][0]["id"] == grace["id"]
    assert client.get(f"/api/v1/people/{ada['id']}").json()["email"] == "ada@example.com"
    log = client.get(f"/api/v1/people/{ada['id']}/changes").json()
    renamed = next(c for c in log if c["field"] == "name" and c["earlier_value"] is not None)
    assert (renamed["earlier_value"], renamed["new_value"]) == ("Ada Lovelace", "Ada King")
    assert renamed["source"] == {"kind": "entered_by_hand"} and renamed["changed_by"] == "Local agent"


def test_a_household_has_dated_members_and_a_person_keeps_the_history_of_households_they_left(
    client: TestClient,
) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    bill = person(client, "Bill King", mobile="0400 333 444")
    home = household(client, "Lovelace-King", ada["id"], bill["id"])
    assert sorted(m["name"] for m in home["members"]) == ["Ada Lovelace", "Bill King"]

    ended = client.post(f"/api/v1/households/{home['id']}/members/{bill['id']}/end", json={"ended_on": "2026-03-01"})
    assert ended.status_code == 200
    now = client.get(f"/api/v1/households/{home['id']}").json()
    assert [m["name"] for m in now["members"]] == ["Ada Lovelace"]
    assert [m["name"] for m in now["former_members"]] == ["Bill King"]
    assert now["former_members"][0]["ended_on"] == "2026-03-01"

    elsewhere = household(client, "Bill alone", bill["id"])
    history = client.get(f"/api/v1/people/{bill['id']}").json()["households"]
    assert {(h["name"], h["ended_on"]) for h in history} == {("Lovelace-King", "2026-03-01"), ("Bill alone", None)}
    assert elsewhere["members"][0]["name"] == "Bill King"


def test_a_member_can_be_added_to_an_existing_household_once(client: TestClient) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    bill = person(client, "Bill King", mobile="0400 333 444")
    home = household(client, "Lovelace-King", ada["id"])

    added = client.post(f"/api/v1/households/{home['id']}/members", json={"person_id": bill["id"]})
    again = client.post(f"/api/v1/households/{home['id']}/members", json={"person_id": bill["id"]})

    assert added.status_code == 200 and again.status_code == 409
    assert len(client.get(f"/api/v1/households/{home['id']}").json()["members"]) == 2


def test_relationships_are_typed_and_read_from_either_side(client: TestClient) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    bill = person(client, "Bill King", mobile="0400 333 444")
    cora = person(client, "Cora King", mobile="0400 555 666")

    assert client.post(f"/api/v1/people/{ada['id']}/relationships", json={"other_person_id": bill["id"], "kind": "partner"}).status_code == 201
    assert client.post(f"/api/v1/people/{ada['id']}/relationships", json={"other_person_id": cora["id"], "kind": "parent", "note": "Ada's mother"}).status_code == 201

    def seen(pid: str) -> set[tuple[str, str]]:
        return {(r["other_name"], r["kind"]) for r in client.get(f"/api/v1/people/{pid}").json()["relationships"]}

    assert seen(ada["id"]) == {("Bill King", "partner"), ("Cora King", "parent")}
    assert seen(bill["id"]) == {("Ada Lovelace", "partner")}
    assert seen(cora["id"]) == {("Ada Lovelace", "child")}  # the inverse of "Ada's parent is Cora"


def test_a_person_cannot_be_related_to_themselves_or_twice_in_the_same_way(client: TestClient) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    bill = person(client, "Bill King", mobile="0400 333 444")

    own = client.post(f"/api/v1/people/{ada['id']}/relationships", json={"other_person_id": ada["id"], "kind": "partner"})
    ok = client.post(f"/api/v1/people/{ada['id']}/relationships", json={"other_person_id": bill["id"], "kind": "partner"})
    twice = client.post(f"/api/v1/people/{bill['id']}/relationships", json={"other_person_id": ada["id"], "kind": "partner"})
    bad = client.post(f"/api/v1/people/{ada['id']}/relationships", json={"other_person_id": bill["id"], "kind": "frenemy"})

    assert own.status_code == 422 and ok.status_code == 201 and twice.status_code == 409 and bad.status_code == 422


def test_an_opportunity_can_be_opened_for_an_existing_household_with_its_current_members(
    client: TestClient,
) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    bill = person(client, "Bill King", mobile="0400 333 444")
    home = household(client, "Lovelace-King", ada["id"], bill["id"])
    client.post(f"/api/v1/households/{home['id']}/members/{bill['id']}/end", json={})

    created = client.post(f"/api/v1/households/{home['id']}/opportunities", json={"budget_aud": 900_000})

    assert created.status_code == 201
    engagement = created.json()
    assert engagement["household_name"] == "Lovelace-King" and engagement["budget_aud"] == 900_000
    assert [c["name"] for c in engagement["clients"]] == ["Ada Lovelace"]
    shown = client.get(f"/api/v1/people/{ada['id']}").json()["engagements"]
    assert [(e["id"], e["stage"]) for e in shown] == [(engagement["id"], "enquiry")]


def test_a_household_with_no_current_member_cannot_have_an_opportunity(client: TestClient) -> None:
    ada = person(client, "Ada Lovelace", mobile="0400 111 222")
    home = household(client, "Lovelace", ada["id"])
    client.post(f"/api/v1/households/{home['id']}/members/{ada['id']}/end", json={})

    assert client.post(f"/api/v1/households/{home['id']}/opportunities", json={}).status_code == 409


def test_people_and_households_belong_to_their_agency_and_survive_a_restart(
    app_client: ClientFactory, another_agency: Any
) -> None:
    first = app_client()
    ada = person(first, "Ada Lovelace", mobile="0400 111 222")
    home = household(first, "Lovelace", ada["id"])

    restarted = app_client()
    assert restarted.get(f"/api/v1/people/{ada['id']}").json()["name"] == "Ada Lovelace"
    assert restarted.get(f"/api/v1/households/{home['id']}").json()["members"][0]["name"] == "Ada Lovelace"

    elsewhere = app_client(another_agency)
    assert elsewhere.get(f"/api/v1/people/{ada['id']}").status_code == 404
    assert elsewhere.get("/api/v1/people").json() == []
    assert elsewhere.get(f"/api/v1/households/{home['id']}").status_code == 404
    assert app_client(None).get("/api/v1/people").status_code == 403


def test_unknown_ids_are_not_found(client: TestClient) -> None:
    assert client.get(f"/api/v1/people/{uuid4()}").status_code == 404
    assert client.get(f"/api/v1/households/{uuid4()}").status_code == 404
