"""Ticket 62: review and apply the straightforward suggestions; ticket 63 rules live in
test_intake_rules.py. Observed through the HTTP API; synthetic material only.
"""
from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import (
    DAN,
    decide,
    decided,
    finish,
    ids,
    item,
    new_opportunity,
    open_review_03,
    read,
    record,
    upload,
)


def test_nothing_can_be_decided_before_the_speakers_are_confirmed(client: TestClient) -> None:
    intake = upload(client, new_opportunity(client))

    refused = decide(client, intake["id"], "accept", "s-pets")

    assert refused.status_code == 409
    assert "review step" in refused.json()["detail"]


def test_each_row_shows_its_value_quote_speaker_and_stated_or_inferred_mark_in_its_group(
    client: TestClient,
) -> None:
    _, intake_id = open_review_03(client)

    pets = item(read(client, intake_id), "s-pets")

    assert (pets["value"], pets["basis"], pets["section"], pets["group"]) == ("A cat", "stated", "profile", "Circumstances")
    assert pets["quotes"][0]["speaker_name"] == "Tash Kumar"
    assert pets["quotes"][0]["text"].startswith("We've got a cat")
    assert pets["bucket"] == "ready"


def test_items_that_need_a_decision_come_before_the_ready_list(client: TestClient) -> None:
    _, intake_id = open_review_03(client)

    buckets = [i["bucket"] for i in read(client, intake_id)["queue"]]

    assert buckets == sorted(buckets, key=["decide", "ready", "done"].index)
    assert buckets[0] == "decide" and "ready" in buckets


def test_accepting_the_rest_applies_only_the_ready_rows_and_touches_nothing_that_needs_a_decision(
    client: TestClient,
) -> None:
    _, intake_id = open_review_03(client)
    before = read(client, intake_id)
    ready, needing_decision = ids(before, "ready"), ids(before, "decide")

    after = client.post(f"/api/v1/intakes/{intake_id}/accept-rest").json()

    assert ids(after, "decide") == needing_decision
    assert sorted(ids(after, "done")) == sorted(ready)
    assert all(item(after, i)["decision"]["status"] == "accepted" for i in ready)


def test_a_value_can_be_edited_before_applying_and_keeps_its_quote_as_the_source(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)

    decided_view = decide(client, intake_id, "edit", "s-worktash", "Works in ICU at Chermside; night shifts").json()
    finish(client, intake_id)

    row = item(decided_view, "s-worktash")
    assert row["decision"] == {"status": "edited", "value": "Works in ICU at Chermside; night shifts"}
    work = next(v for v in record(client, engagement_id) if v["field"] == "work")
    assert work["value"] == "Works in ICU at Chermside; night shifts"
    assert work["subject"] == "Tash Kumar"
    assert work["quotes"][0]["text"] == "At the hospital at Chermside. In ICU."
    assert "edited" in work["source"]


def test_a_decision_can_be_undone_and_the_row_returns_to_where_it_was(client: TestClient) -> None:
    _, intake_id = open_review_03(client)

    decided(client, intake_id, "reject", "s-pets")
    undone = decide(client, intake_id, "undo", "s-pets").json()

    assert item(undone, "s-pets")["bucket"] == "ready"
    assert item(undone, "s-pets")["decision"] is None


def test_speakers_lock_at_the_first_decision_and_unlock_when_it_is_undone(client: TestClient) -> None:
    _, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")

    locked = client.post(f"/api/v1/intakes/{intake_id}/speakers/edit")
    assert locked.status_code == 409 and "locked" in locked.json()["detail"]
    assert client.put(
        f"/api/v1/intakes/{intake_id}/speakers", json={"label": DAN, "kind": "household", "name": "Dan"}
    ).status_code == 409

    decided(client, intake_id, "undo", "s-pets")
    assert client.post(f"/api/v1/intakes/{intake_id}/speakers/edit").status_code == 200


def test_a_row_cannot_be_decided_twice_without_undoing_it(client: TestClient) -> None:
    _, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")

    again = decide(client, intake_id, "reject", "s-pets")

    assert again.status_code == 409 and "Already decided" in again.json()["detail"]


def test_undecided_items_write_nothing_and_only_accepted_values_reach_the_record(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets", "s-beds")
    decided(client, intake_id, "reject", "s-timeline")

    result = finish(client, intake_id)

    assert result["stage"] == "result"
    assert result["summary"]["written"] == 2
    assert {(v["field"], v["value"]) for v in record(client, engagement_id)} == {
        ("pets", "A cat"),
        ("bedrooms", "3, or 2 plus a study"),
    }
    assert len(result["summary"]["undecided"]) == len(result["queue"]) - 3
    assert [i["id"] for i in result["summary"]["rejected"]] == ["s-timeline"]


def test_finishing_shows_the_applied_brief_what_the_call_did_not_cover_and_next_actions_with_owners(
    client: TestClient,
) -> None:
    _, intake_id = open_review_03(client)
    client.post(f"/api/v1/intakes/{intake_id}/accept-rest")

    result = finish(client, intake_id)["summary"]

    brief = {e["field"]: e["value"] for e in result["entries"]["brief"]}
    assert brief["bedrooms"] == "3, or 2 plus a study"
    assert "Referral source" in result["not_covered"]
    assert "Bathrooms" in result["not_covered"]
    actions = {e["value"]: (e["owners"], e["due"]) for e in result["entries"]["actions"]}
    assert actions["Send Dan his last two (October) payslips"] == (["Rhys Gallagher"], "Tonight")


def test_properties_mentioned_keep_their_outcome_and_a_partial_address_stays_partial(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    client.post(f"/api/v1/intakes/{intake_id}/accept-rest")
    finish(client, intake_id)

    properties = {v["value"] for v in record(client, engagement_id) if v["section"] == "properties"}

    assert properties == {"Townhouse in Kedron — missed", "A property in Stafford — inspecting on Saturday"}
    assert not any(any(ch.isdigit() for ch in p.split("—")[0]) for p in properties)


def test_every_accepted_value_has_a_change_log_entry_with_its_source(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)
    decided(client, intake_id, "accept", "s-pets")
    finish(client, intake_id)

    entries = [c for c in client.get(f"/api/v1/engagements/{engagement_id}/changes").json() if c["field"] == "pets"]

    assert len(entries) == 1
    source = entries[0]["source"]
    assert entries[0]["new_value"] == "A cat"
    assert entries[0]["changed_by"] == "Local agent"
    assert source["kind"] == "call_intake"
    assert source["transcript"].startswith("03-broker-joins-first-home-north")
    assert source["decision"] == "accepted" and source["edited"] is False
    assert source["speaker"] == "Tash Kumar"
    assert source["quotes"][0]["text"].startswith("We've got a cat")
    assert source["accepted_at"]


def test_review_time_is_recorded_per_transcript_when_the_review_finishes(client: TestClient) -> None:
    _, intake_id = open_review_03(client)
    assert read(client, intake_id)["review_seconds"] is None

    result = finish(client, intake_id)

    assert isinstance(result["review_seconds"], int) and result["review_seconds"] >= 0


def test_a_finished_review_cannot_be_decided_again(client: TestClient) -> None:
    _, intake_id = open_review_03(client)
    finish(client, intake_id)

    assert decide(client, intake_id, "accept", "s-pets").status_code == 409
    assert client.post(f"/api/v1/intakes/{intake_id}/finish").status_code == 409


def test_decisions_and_the_applied_record_survive_a_restart(app_client: ClientFactory) -> None:
    first = app_client()
    engagement_id, intake_id = open_review_03(first)
    decided(first, intake_id, "accept", "s-pets")
    mid_review = app_client()
    assert item(read(mid_review, intake_id), "s-pets")["decision"]["status"] == "accepted"

    finish(mid_review, intake_id)
    restarted = app_client()

    assert read(restarted, intake_id)["stage"] == "result"
    assert [(v["field"], v["value"]) for v in record(restarted, engagement_id)] == [("pets", "A cat")]


def test_a_new_household_member_and_the_professional_are_recorded_when_the_review_finishes(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    assert [c["name"] for c in client.get(f"/api/v1/engagements/{engagement_id}").json()["clients"]] == ["Tash Kumar"]

    finish(client, intake_id)

    names = [c["name"] for c in client.get(f"/api/v1/engagements/{engagement_id}").json()["clients"]]
    assert names == ["Tash Kumar", "Rhys Gallagher"]
    professionals = client.get(f"/api/v1/engagements/{engagement_id}/record").json()["professionals"]
    assert [(p["name"], p["role"]) for p in professionals] == [("Dan", "Mortgage broker")]


def test_notes_the_scripted_extractor_does_not_know_give_an_empty_review_and_say_so(
    client: TestClient,
) -> None:
    from tests.helpers import upload_text

    notes = "Wants 3 beds.\nBudget about 800k."
    intake = upload_text(client, new_opportunity(client), "pasted notes", notes, notes=True)

    assert intake["speakers"][0]["match"]["kind"] == "agent"
    assert intake["queue"] == []
    assert "no recorded suggestions" in intake["extraction_note"]
