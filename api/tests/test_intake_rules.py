"""Ticket 63: the review rules James confirmed on the prototype, as API behaviour. The three
prototype walkthroughs are the acceptance cases. Synthetic material only.
"""
from fastapi.testclient import TestClient

from tests.helpers import (
    DAN,
    NADIA,
    TASH,
    decide,
    decided,
    finish,
    ids,
    item,
    match,
    new_opportunity,
    open_review_03,
    read,
    record,
    upload,
)

FLAGGED = ["s-ceiling", "s-agentareas", "s-trainbus", "a-carloan"]


def test_exactly_the_flagged_items_cannot_be_applied(client: TestClient) -> None:
    _, intake_id = open_review_03(client)

    view = read(client, intake_id)

    assert sorted(i["id"] for i in view["queue"] if i["blocked"]) == sorted(FLAGGED)
    assert item(view, "s-ceiling")["reasons"][0]["text"] == "Not said by the buyers"
    assert item(view, "a-carloan")["reasons"][0]["text"] == "No commitment from who owes it"
    assert item(view, "s-agentareas")["blocked"] == "Only you (the agent) said this. It counts once a buyer confirms it."


def test_a_flagged_item_has_no_override_it_can_only_be_asked_or_rejected(client: TestClient) -> None:
    _, intake_id = open_review_03(client)

    for kind in ("accept", "edit"):
        refused = decide(client, intake_id, kind, "s-ceiling", "About $950k")
        assert refused.status_code == 409, kind
        assert "Someone else's figure stays their own fact" in refused.json()["detail"]
    assert decide(client, intake_id, "useEarlier", "s-ceiling").status_code == 409
    assert read(client, intake_id)["queue"][0]["bucket"] != "done"

    asked = decide(client, intake_id, "ask", "s-trainbus")
    rejected = decide(client, intake_id, "reject", "s-ceiling")
    assert asked.status_code == 200 and rejected.status_code == 200


def test_finance_facts_may_come_from_a_professional_but_the_buyers_own_requirements_may_not(
    client: TestClient,
) -> None:
    _, intake_id = open_review_03(client)
    view = read(client, intake_id)

    for finance in ("s-preapproval", "s-guidance", "s-scheme", "s-broker"):
        assert item(view, finance)["blocked"] is None, finance
    assert item(view, "s-ceiling")["blocked"] is not None


def test_a_value_changed_during_the_call_shows_the_earlier_value_and_either_can_be_applied(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    rent = item(read(client, intake_id), "s-housing")

    assert rent["conflict"]["type"] == "superseded"
    assert rent["conflict"]["earlier"]["value"].startswith("Renting in Lutwyche; rent up about $120")
    decided(client, intake_id, "accept", "s-housing")
    chosen_earlier = decided(client, intake_id, "useEarlier", "s-budget")
    finish(client, intake_id)

    values = {v["field"]: v for v in record(client, engagement_id)}
    assert values["housing"]["value"].endswith("rent up about $130 a week over two years")
    assert values["budgetTarget"]["value"] == "About $950k"  # chose the earlier value
    assert item(chosen_earlier, "s-budget")["decision"]["status"] == "earlier"


def test_replacing_a_value_on_record_needs_its_own_decision_and_history_keeps_the_earlier_value(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    budget = item(read(client, intake_id), "s-budget")

    assert budget["current"] == {"value": "$950k", "source": "Entered by hand"}
    assert [r["code"] for r in budget["reasons"]] == ["changed", "replaces", "inferred"]
    client.post(f"/api/v1/intakes/{intake_id}/accept-rest")
    assert item(read(client, intake_id), "s-budget")["decision"] is None

    decided(client, intake_id, "accept", "s-budget")
    finish(client, intake_id)

    change = next(c for c in client.get(f"/api/v1/engagements/{engagement_id}/changes").json() if c["field"] == "budgetTarget")
    assert change["new_value"] == "About $900k (established property)"
    assert change["earlier_value"] == {"value": "$950k", "source": "Entered by hand"}
    assert client.get(f"/api/v1/engagements/{engagement_id}").json()["budget_aud"] == 900_000
    on_record = next(v for v in record(client, engagement_id) if v["field"] == "budgetTarget")
    assert on_record["earlier"] == [{"value": "$950k", "source": "Entered by hand"}]


def test_a_disagreement_between_decision_makers_can_be_kept_as_unresolved_to_discuss(
    client: TestClient,
) -> None:
    engagement_id, intake_id = open_review_03(client)
    aspley = item(read(client, intake_id), "s-aspley")
    assert aspley["conflict"]["type"] == "disagreement"
    assert {v["person"] for v in aspley["conflict"]["views"]} == {"Rhys Gallagher", "Tash Kumar"}

    decided(client, intake_id, "accept", "s-aspley", "s-service")
    summary = finish(client, intake_id)["summary"]

    assert {e["field"] for e in summary["to_discuss"]} == {"areas", "service"}
    assert all(e["field"] != "service" for e in summary["entries"]["intake"])
    assert "Service wanted: undecided (to discuss)" in summary["not_covered"]
    discussed = [v for v in record(client, engagement_id) if v["status"] == "discuss"]
    assert len(discussed) == 2


def test_walkthrough_careful_review_keeps_all_17_key_items_and_nothing_slips(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)

    decided(client, intake_id, "accept", "s-budget", "s-housing", "s-aspley", "s-service", "s-workrhys")
    decided(client, intake_id, "reject", "s-ceiling", "s-agentareas", "a-carloan")
    decided(client, intake_id, "ask", "s-trainbus")
    decided(
        client, intake_id, "accept",
        "s-finalsay", "s-broker", "s-purpose", "s-sellfirst", "s-type", "s-pet", "s-db-planes", "s-older",
        "s-strata", "a-links",
    )
    decide(client, intake_id, "edit", "s-worktash", "Works in ICU at the hospital at Chermside; night shifts (job title not given)")
    decided(client, intake_id, "reject", "s-train")
    client.post(f"/api/v1/intakes/{intake_id}/accept-rest")
    summary = finish(client, intake_id)["summary"]

    values = record(client, engagement_id)
    key_fields = {"budgetTarget": 1, "preApproval": 1, "dealBreakers": 6, "nextActions": 9}
    for field, expected in key_fields.items():
        assert sum(1 for v in values if v["field"] == field) == expected, field
    assert sum(key_fields.values()) == 17
    recorded = {v["value"] for v in values}
    assert "$950k" not in recorded and "$910k" not in recorded  # the broker's figures never became the ceiling
    assert not any(v["field"] == "budgetCeiling" for v in values)
    assert "Send Dan the car-loan statement" not in recorded
    assert not any("nurse" in v["value"].lower() for v in values)  # the invented detail was edited out
    assert not any(v["value"] == "Close to a train station" for v in values)
    assert [i["id"] for i in summary["ask"]] == ["s-trainbus"]
    assert summary["undecided"] == []


def test_walkthrough_speed_run_holds_back_the_four_flagged_items(client: TestClient) -> None:
    engagement_id, intake_id = open_review_03(client)
    view = read(client, intake_id)

    for suggestion_id in ids(view, "decide"):
        decide(client, intake_id, "accept", suggestion_id)  # flagged ones are refused
    client.post(f"/api/v1/intakes/{intake_id}/accept-rest")
    summary = finish(client, intake_id)["summary"]

    assert sorted(i["id"] for i in summary["undecided"]) == sorted(FLAGGED)
    written = {v["value"] for v in record(client, engagement_id)}
    assert not written & {"$950k", "Send Dan the car-loan statement", "Near the train line or the busway"}


def test_walkthrough_broker_matched_as_a_client_shows_the_warning_and_his_ceiling_is_no_longer_flagged(
    client: TestClient,
) -> None:
    engagement_id = new_opportunity(client)
    intake = upload(client, engagement_id)
    match(client, intake["id"], NADIA, "agent", "Nadia Pearce")
    match(client, intake["id"], TASH, "household", "Tash Kumar")
    match(client, intake["id"], "Rhys Gallagher", "household", "Rhys Gallagher", is_new=True)
    matched = match(client, intake["id"], DAN, "household", "Dan", is_new=True)

    dan = next(s for s in matched["speakers"] if s["label"] == DAN)
    assert dan["warning"] is not None

    view = client.post(f"/api/v1/intakes/{intake['id']}/speakers/confirm").json()
    ceiling = item(view, "s-ceiling")
    assert ceiling["blocked"] is None
    assert ceiling["bucket"] == "ready"


def test_moves_the_rules_forbid_are_refused_and_change_nothing(client: TestClient) -> None:
    _, intake_id = open_review_03(client)
    before = read(client, intake_id)

    assert decide(client, intake_id, "useEarlier", "s-pets").status_code == 409  # nothing changed during the call
    assert decide(client, intake_id, "edit", "s-pets", "   ").status_code == 409  # empty edit
    assert decide(client, intake_id, "undo", "s-pets").status_code == 409  # nothing to undo
    assert decide(client, intake_id, "accept", "no-such-id").status_code == 409

    after = read(client, intake_id)
    assert after["queue"] == before["queue"]
