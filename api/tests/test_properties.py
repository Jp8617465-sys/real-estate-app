"""Slice 4: properties, assessment against the brief, and the shortlist. Unknown facts stay unknown;
partial addresses stay partial. Observed through the HTTP API; synthetic material only."""
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import new_opportunity


def prop(client: TestClient, address: str, **extra: Any) -> dict[str, Any]:
    response = client.post("/api/properties", json={"address_line": address, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def attach(client: TestClient, engagement_id: str, property_id: str, **extra: Any) -> dict[str, Any]:
    response = client.post(f"/api/engagements/{engagement_id}/properties", json={"property_id": property_id, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def shortlist(client: TestClient, engagement_id: str, **params: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = client.get(f"/api/engagements/{engagement_id}/properties", params=params).json()["properties"]
    return rows


def test_a_property_keeps_unknown_facts_unknown_and_a_partial_address_partial(client: TestClient) -> None:
    p = prop(client, "A townhouse on Webster Rd (number unknown)", suburb="Stafford")

    assert p["suburb"] == "Stafford"
    assert (p["bedrooms"], p["price_guide_low"], p["land_m2"]) == (None, None, None)
    assert p["source"] == "Entered by hand"


def test_a_property_is_found_by_address_or_suburb_and_duplicates_need_confirming(client: TestClient) -> None:
    a = prop(client, "12 Example St", suburb="Kedron", bedrooms=3)
    prop(client, "9 Sample Ave", suburb="Nundah")

    assert [p["id"] for p in client.get("/api/properties", params={"q": "kedron"}).json()] == [a["id"]]
    assert [p["id"] for p in client.get("/api/properties", params={"q": "sample"}).json()] != []
    dup = client.post("/api/properties", json={"address_line": "12 example st", "suburb": "KEDRON"})
    assert dup.status_code == 409 and dup.json()["detail"]["matches"][0]["id"] == a["id"]
    assert client.post("/api/properties", json={"address_line": "12 example st", "suburb": "KEDRON", "confirm_duplicate": True}).status_code == 201


def test_a_property_can_be_edited_and_a_fact_cleared_back_to_unknown(client: TestClient) -> None:
    p = prop(client, "12 Example St", suburb="Kedron", bedrooms=3, price_guide_low=850_000)

    edited = client.patch(f"/api/properties/{p['id']}", json={"bedrooms": 4, "price_guide_low": None})

    assert edited.status_code == 200
    assert (edited.json()["bedrooms"], edited.json()["price_guide_low"], edited.json()["suburb"]) == (4, None, "Kedron")


def test_a_property_is_attached_to_an_engagement_once_and_has_its_own_status_there(client: TestClient) -> None:
    one, two = new_opportunity(client), new_opportunity(client, {"household_name": "B", "client": {"name": "B Client", "email": "b@example.com"}})
    p = prop(client, "12 Example St", suburb="Kedron")

    first = attach(client, one, p["id"])
    again = client.post(f"/api/engagements/{one}/properties", json={"property_id": p["id"]})
    attach(client, two, p["id"], status="passed")

    assert first["status"] == "considering" and again.status_code == 409
    assert [r["status"] for r in shortlist(client, one)] == ["considering"]
    assert [r["status"] for r in shortlist(client, two)] == ["passed"]


def test_the_assessment_status_and_reasons_are_edited_and_logged(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    link = attach(client, engagement_id, prop(client, "12 Example St", suburb="Kedron")["id"])

    done = client.patch(
        f"/api/engagements/{engagement_id}/properties/{link['id']}",
        json={"status": "shortlisted", "assessment": "Good bones, busy road", "reasons": "Within budget; 20 min to the hospital"},
    )

    assert done.status_code == 200 and done.json()["status"] == "shortlisted"
    assert [r["id"] for r in shortlist(client, engagement_id, status="shortlisted")] == [link["id"]]
    assert shortlist(client, engagement_id, status="passed") == []
    log = [c for c in client.get(f"/api/engagements/{engagement_id}/changes").json() if "12 Example St" in c["field"]]
    assert {(c["field"].split(":")[-1], c["new_value"]) for c in log} >= {("status", "shortlisted"), ("assessment", "Good bones, busy road")}
    bad = client.patch(f"/api/engagements/{engagement_id}/properties/{link['id']}", json={"status": "teleported"})
    assert bad.status_code == 422


def test_checks_against_the_brief_are_recorded_one_per_criterion_and_counted(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    link = attach(client, engagement_id, prop(client, "12 Example St", suburb="Kedron")["id"])
    url = f"/api/engagements/{engagement_id}/properties/{link['id']}/checks"

    client.put(url, json={"criterion": "20 minutes to the hospital", "result": "meets"})
    client.put(url, json={"criterion": "Not on a main road", "result": "fails", "note": "Gympie Rd frontage"})
    client.put(url, json={"criterion": "Pet friendly by-laws", "result": "unknown"})
    client.put(url, json={"criterion": "Not on a main road", "result": "partly", "note": "Side street entrance"})  # replaces
    bad = client.put(url, json={"criterion": "x", "result": "maybe"})

    row = shortlist(client, engagement_id)[0]
    assert bad.status_code == 422
    assert {c["criterion"]: c["result"] for c in row["checks"]} == {
        "20 minutes to the hospital": "meets", "Not on a main road": "partly", "Pet friendly by-laws": "unknown",
    }
    assert row["fit"] == {"meets": 1, "partly": 1, "fails": 0, "unknown": 1}


def test_the_price_guide_is_compared_with_the_budget_and_unknown_stays_unknown(client: TestClient) -> None:
    engagement_id = new_opportunity(client)  # budget 950,000
    cases = {"A": (800_000, 900_000, "within"), "B": (900_000, 1_000_000, "stretch"), "C": (1_000_000, 1_100_000, "over"), "D": (None, None, "unknown")}
    for address, (low, high, _) in cases.items():
        attach(client, engagement_id, prop(client, address, price_guide_low=low, price_guide_high=high)["id"])

    fits = {r["property"]["address_line"]: r["budget_fit"] for r in shortlist(client, engagement_id)}

    assert fits == {k: v[2] for k, v in cases.items()}


def test_criteria_to_check_are_suggested_from_the_brief(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    client.post(f"/api/engagements/{engagement_id}/brief/dealBreakers/values", json={"value": "On Gympie Road"})
    client.post(f"/api/engagements/{engagement_id}/brief/mustHaves/values", json={"value": "Lockable garage"})
    client.put(f"/api/engagements/{engagement_id}/brief/bedrooms", json={"value": "3"})

    body = client.get(f"/api/engagements/{engagement_id}/properties").json()

    assert body["suggested_criteria"] == ["Deal-breaker: On Gympie Road", "Must-have: Lockable garage", "Bedrooms: 3"]


def test_properties_belong_to_their_agency_and_survive_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    engagement_id = new_opportunity(first)
    p = prop(first, "12 Example St", suburb="Kedron")
    attach(first, engagement_id, p["id"])

    assert shortlist(app_client(), engagement_id)[0]["property"]["address_line"] == "12 Example St"
    elsewhere = app_client(another_agency)
    assert elsewhere.get(f"/api/properties/{p['id']}").status_code == 404
    assert elsewhere.get("/api/properties").json() == []
