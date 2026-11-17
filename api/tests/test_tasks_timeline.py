"""Slice 6: tasks with an owner and a due date, and a dated timeline of everything that happened on an
engagement. Observed through the HTTP API; synthetic material only."""
from datetime import date, timedelta
from typing import Any

from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import decided, finish, new_opportunity, open_review_03


def task(client: TestClient, title: str, **extra: Any) -> dict[str, Any]:
    response = client.post("/api/v1/tasks", json={"title": title, **extra})
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def tasks(client: TestClient, **params: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = client.get("/api/v1/tasks", params=params).json()
    return rows


def test_a_task_is_created_listed_done_and_reopened(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    t = task(client, "Send the proposal", engagement_id=engagement_id, owner="Nadia", due_on="2026-12-01")

    assert [x["title"] for x in tasks(client, engagement_id=engagement_id)] == ["Send the proposal"]
    done = client.post(f"/api/v1/tasks/{t['id']}/done")
    assert done.status_code == 200 and done.json()["done_at"]
    assert tasks(client, state="open") == [] and [x["id"] for x in tasks(client, state="done")] == [t["id"]]
    reopened = client.post(f"/api/v1/tasks/{t['id']}/reopen")
    assert reopened.json()["done_at"] is None and len(tasks(client, state="open")) == 1


def test_overdue_tasks_are_flagged_and_listed_first_and_the_summary_counts_them(client: TestClient) -> None:
    today = date.today()
    task(client, "Later", due_on=(today + timedelta(days=5)).isoformat())
    task(client, "No date")
    task(client, "Overdue", due_on=(today - timedelta(days=2)).isoformat())
    task(client, "Today", due_on=today.isoformat())

    rows = tasks(client, state="open")

    assert [r["title"] for r in rows] == ["Overdue", "Today", "Later", "No date"]
    assert [r["overdue"] for r in rows] == [True, False, False, False]
    assert client.get("/api/v1/tasks/summary").json() == {"open": 4, "overdue": 1, "due_today": 1}


def test_a_task_can_be_edited_and_bad_input_is_refused(client: TestClient) -> None:
    t = task(client, "Call Dan")

    edited = client.patch(f"/api/v1/tasks/{t['id']}", json={"title": "Call Dan about the pre-approval", "owner": "Ops", "due_on": "2026-12-02"})

    assert edited.status_code == 200 and (edited.json()["owner"], edited.json()["due_on"]) == ("Ops", "2026-12-02")
    assert client.post("/api/v1/tasks", json={"title": "  "}).status_code == 422
    assert client.post("/api/v1/tasks", json={"title": "x", "due_on": "tomorrow"}).status_code == 422
    assert client.post("/api/v1/tasks", json={"title": "x", "engagement_id": "00000000-0000-4000-8000-000000000009"}).status_code == 404


def test_the_timeline_shows_what_happened_newest_first_with_where_it_came_from(client: TestClient) -> None:
    engagement_id = new_opportunity(client)
    client.post(f"/api/v1/engagements/{engagement_id}/stage", json={"stage": "consultation"})
    client.put(f"/api/v1/engagements/{engagement_id}/brief/bedrooms", json={"value": "3"})
    t = task(client, "Send the proposal", engagement_id=engagement_id)
    client.post(f"/api/v1/tasks/{t['id']}/done")
    prop = client.post("/api/v1/properties", json={"address_line": "12 Example St", "suburb": "Kedron"}).json()
    client.post(f"/api/v1/engagements/{engagement_id}/properties", json={"property_id": prop["id"]})

    events = client.get(f"/api/v1/engagements/{engagement_id}/timeline").json()

    titles = [e["title"] for e in events]
    assert "Stage moved: enquiry → consultation" in titles
    assert "Bedrooms: 3" in titles
    assert "Task added: Send the proposal" in titles and "Task done: Send the proposal" in titles
    assert any(t.startswith("12 Example St") for t in titles)
    assert titles[-1].startswith("Opportunity opened")
    assert [e["at"] for e in events] == sorted((e["at"] for e in events), reverse=True)
    assert {e["source"] for e in events if e["title"] == "Bedrooms: 3"} == {"Entered by hand"}


def test_the_timeline_includes_a_call_and_the_values_it_recorded(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")
    finish(client, intake_id)

    events = client.get(f"/api/v1/engagements/{engagement_id}/timeline").json()

    titles = [e["title"] for e in events]
    assert any(t.startswith("Call reviewed: 03-broker-joins-first-home-north") for t in titles)
    assert any(t == "Pets: A cat" for t in titles)
    assert {e["source"] for e in events if e["title"] == "Pets: A cat"} == {"03-broker-joins-first-home-north.vtt · Tash Kumar · accepted at review"}


def test_next_actions_from_a_call_become_tasks_once(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "a-tash-roster", "a-rhys-payslips")
    finish(client, intake_id)

    first = client.post(f"/api/v1/engagements/{engagement_id}/tasks/from-actions")
    second = client.post(f"/api/v1/engagements/{engagement_id}/tasks/from-actions")

    assert first.status_code == 201 and len(first.json()) == 2
    assert second.json() == []
    rows = {r["title"]: r for r in tasks(client, engagement_id=engagement_id)}
    roster = rows["Get her roster, or a hospital letter showing regular penalties, from her manager for Dan"]
    assert roster["owner"] == "Tash Kumar" and roster["due_text"] == "Tomorrow night"


def test_tasks_belong_to_their_agency_and_survive_a_restart(app_client: ClientFactory, another_agency: Any) -> None:
    first = app_client()
    t = task(first, "Call Dan")

    assert [x["id"] for x in tasks(app_client())] == [t["id"]]
    elsewhere = app_client(another_agency)
    assert tasks(elsewhere) == [] and elsewhere.post(f"/api/v1/tasks/{t['id']}/done").status_code == 404
