"""Ticket 60: the agent creates a buying opportunity by hand and finds it again.

Everything is observed through the HTTP API, the single agreed seam. Material is synthetic.
"""
from uuid import UUID

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory

NGUYENS = {
    "household_name": "The Synthetic Nguyens",
    "client": {"name": "Linh Nguyen", "email": "linh.nguyen@example.com"},
    "budget_aud": 950_000,
}


def test_agent_creates_a_buying_opportunity_and_finds_it_in_the_list_and_on_its_own_page(
    client: TestClient,
) -> None:
    created = client.post("/api/engagements", json=NGUYENS)

    assert created.status_code == 201
    engagement_id = created.json()["id"]

    listed = client.get("/api/engagements").json()
    assert [(e["id"], e["household_name"]) for e in listed] == [
        (engagement_id, "The Synthetic Nguyens")
    ]

    page = client.get(f"/api/engagements/{engagement_id}").json()
    assert page["service_line"] == "buying"
    assert page["stage"] == "enquiry"
    assert page["household_name"] == "The Synthetic Nguyens"
    assert page["budget_aud"] == 950_000
    assert [(c["name"], c["email"], c["mobile"]) for c in page["clients"]] == [
        ("Linh Nguyen", "linh.nguyen@example.com", None)
    ]


def test_budget_is_optional_and_a_mobile_alone_is_enough_to_reach_the_client(
    client: TestClient,
) -> None:
    created = client.post(
        "/api/engagements",
        json={
            "household_name": "The Synthetic Okafors",
            "client": {"name": "Ada Okafor", "mobile": "0400 000 123"},
        },
    )

    page = client.get(f"/api/engagements/{created.json()['id']}").json()
    assert page["budget_aud"] is None
    assert [(c["email"], c["mobile"]) for c in page["clients"]] == [(None, "0400 000 123")]


def test_the_opportunity_is_still_there_after_the_app_restarts(app_client: ClientFactory) -> None:
    first_run = app_client()
    engagement_id = first_run.post("/api/engagements", json=NGUYENS).json()["id"]

    after_restart = app_client()

    page = after_restart.get(f"/api/engagements/{engagement_id}").json()
    assert (page["household_name"], page["budget_aud"]) == ("The Synthetic Nguyens", 950_000)
    assert [e["id"] for e in after_restart.get("/api/engagements").json()] == [engagement_id]


def test_a_client_with_no_email_or_mobile_is_refused_and_nothing_is_saved(
    client: TestClient,
) -> None:
    refused = client.post(
        "/api/engagements",
        json={"household_name": "The Synthetic Lees", "client": {"name": "Sam Lee"}},
    )

    assert refused.status_code == 422
    assert client.get("/api/engagements").json() == []


def test_every_value_the_agent_entered_has_a_change_log_entry_sourced_to_entry_by_hand(
    client: TestClient,
) -> None:
    engagement_id = client.post("/api/engagements", json=NGUYENS).json()["id"]

    changes = client.get(f"/api/engagements/{engagement_id}/changes").json()

    assert sorted((c["entity"], c["field"], c["new_value"]) for c in changes) == [
        ("brief", "budget_aud", 950_000),
        ("client", "email", "linh.nguyen@example.com"),
        ("client", "name", "Linh Nguyen"),
        ("household", "name", "The Synthetic Nguyens"),
    ]
    assert all(c["earlier_value"] is None for c in changes)
    assert all(c["source"] == {"kind": "entered_by_hand"} for c in changes)
    assert all(c["changed_by"] and c["changed_at"] for c in changes)


def test_an_agency_never_sees_or_touches_another_agencys_records(
    app_client: ClientFactory, another_agency: UUID
) -> None:
    ours = app_client()
    theirs = app_client(agency_id=another_agency)
    our_engagement = ours.post("/api/engagements", json=NGUYENS).json()["id"]
    their_engagement = theirs.post(
        "/api/engagements",
        json={
            "household_name": "The Synthetic Rossis",
            "client": {"name": "Gia Rossi", "email": "gia.rossi@example.com"},
        },
    ).json()["id"]

    assert [e["id"] for e in ours.get("/api/engagements").json()] == [our_engagement]
    assert [e["id"] for e in theirs.get("/api/engagements").json()] == [their_engagement]
    assert theirs.get(f"/api/engagements/{our_engagement}").status_code == 404
    assert theirs.get(f"/api/engagements/{our_engagement}/changes").status_code == 404
    assert ours.get(f"/api/engagements/{their_engagement}").status_code == 404


def test_without_an_agency_nothing_can_be_read_or_written(app_client: ClientFactory) -> None:
    with_agency = app_client()
    existing = with_agency.post("/api/engagements", json=NGUYENS).json()["id"]
    without_agency = app_client(agency_id=None)

    assert without_agency.post("/api/engagements", json=NGUYENS).status_code == 403
    assert without_agency.get("/api/engagements").status_code == 403
    assert without_agency.get(f"/api/engagements/{existing}").status_code == 403
    assert [e["id"] for e in with_agency.get("/api/engagements").json()] == [existing]
