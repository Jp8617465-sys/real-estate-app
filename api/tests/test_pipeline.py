"""Slice 2: the engagement pipeline. Stages (provisional), moves that are logged, a board.

Observed through the HTTP API; synthetic material only.
"""
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import new_opportunity


def move(client: TestClient, engagement_id: str, stage: str, **extra: Any) -> Any:
    return client.post(f"/api/v1/engagements/{engagement_id}/stage", json={"stage": stage, **extra})


def test_the_pipeline_lists_its_stages_in_order_grouped_by_service_phase(client: TestClient) -> None:
    stages = client.get("/api/v1/pipeline/stages").json()

    keys = [s["key"] for s in stages]
    assert keys[:3] == ["enquiry", "qualified", "consultation"]
    assert keys.index("agreed") < keys.index("searching") < keys.index("settled") < keys.index("aftercare")
    assert keys[-1] == "closed"
    assert {s["group"] for s in stages} == {"sales", "buying", "after", "closed"}


def test_moving_an_engagement_changes_its_stage_and_is_logged_with_who_and_when(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    moved = move(client, engagement_id, "consultation")

    assert moved.status_code == 200 and moved.json()["stage"] == "consultation"
    assert client.get(f"/api/v1/engagements/{engagement_id}").json()["stage"] == "consultation"
    history = client.get(f"/api/v1/engagements/{engagement_id}/stage-history").json()
    assert [(h["earlier_value"], h["new_value"], h["changed_by"]) for h in history] == [("enquiry", "consultation", "Local agent")]
    assert history[0]["changed_at"]


def test_an_unknown_stage_or_the_same_stage_is_refused(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    assert move(client, engagement_id, "teleported").status_code == 422
    same = move(client, engagement_id, "enquiry")
    assert same.status_code == 409 and "already" in same.json()["detail"]


def test_closing_needs_a_reason_and_it_is_kept_and_cleared_when_reopened(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    assert move(client, engagement_id, "closed").status_code == 422
    closed = move(client, engagement_id, "closed", reason="Did not proceed: bought privately")
    assert closed.json()["stage"] == "closed" and closed.json()["closed_reason"] == "Did not proceed: bought privately"

    reopened = move(client, engagement_id, "qualified")
    assert reopened.status_code == 200 and reopened.json()["closed_reason"] is None
    history = client.get(f"/api/v1/engagements/{engagement_id}/stage-history").json()
    assert [h["new_value"] for h in history] == ["closed", "qualified"]


def test_a_reason_is_only_for_closing(client: TestClient) -> None:
    engagement_id = new_opportunity(client)

    assert move(client, engagement_id, "qualified", reason="because").status_code == 422


def test_the_board_groups_engagements_by_stage_with_how_long_they_have_been_there(client: TestClient) -> None:
    a = new_opportunity(client)
    b = new_opportunity(client, {"household_name": "Other (synthetic)", "client": {"name": "Cy Other", "email": "cy@example.com"}})
    move(client, b, "proposal")

    board = client.get("/api/v1/pipeline").json()

    by_stage = {c["stage"]: c["engagements"] for c in board["columns"]}
    assert [e["id"] for e in by_stage["enquiry"]] == [a]
    assert [e["household_name"] for e in by_stage["proposal"]] == ["Other (synthetic)"]
    assert by_stage["proposal"][0]["client_names"] == ["Cy Other"]
    assert by_stage["proposal"][0]["days_in_stage"] == 0
    assert by_stage["settled"] == []


def test_a_move_survives_a_restart_and_stays_in_its_agency(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    engagement_id = new_opportunity(first)
    move(first, engagement_id, "agreed")

    restarted = app_client()
    assert restarted.get(f"/api/v1/engagements/{engagement_id}").json()["stage"] == "agreed"
    elsewhere = app_client(another_agency)
    assert move(elsewhere, engagement_id, "searching").status_code == 404
    assert [e for c in elsewhere.get("/api/v1/pipeline").json()["columns"] for e in c["engagements"]] == []
