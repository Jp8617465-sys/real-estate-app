"""Ticket 61: upload a discovery-call transcript (or notes) and match speakers before any review.

Observed through the HTTP API with the scripted extractor, which replays the hand-written
suggestions for transcript 03. Material is synthetic.
"""
from fastapi.testclient import TestClient

from tests.conftest import ClientFactory
from tests.helpers import (
    DAN,
    NADIA,
    RHYS,
    TASH,
    match,
    new_opportunity,
    transcript,
    upload,
    upload_text,
)


def labels(intake: dict[str, object]) -> list[str]:
    speakers = intake["speakers"]
    assert isinstance(speakers, list)
    return [s["label"] for s in speakers]


def test_a_vtt_with_name_cues_gives_its_speakers_and_turns(client: TestClient) -> None:
    intake = upload(client, new_opportunity(client), "03")

    assert intake["stage"] == "speakers"
    assert labels(intake) == [NADIA, TASH, RHYS, DAN]
    assert intake["turns"][1] == {
        "n": 1,
        "time": "00:09",
        "speaker": TASH,
        "text": "Yep, all good.",
    }


def test_a_vtt_with_voice_tags_gives_its_speakers_without_the_tags_in_the_text(
    client: TestClient,
) -> None:
    intake = upload(client, new_opportunity(client), "02")

    assert all("<v " not in t["text"] and "</v>" not in t["text"] for t in intake["turns"])
    assert len(labels(intake)) >= 2
    assert all(label != "Unknown" for label in labels(intake))


def test_a_txt_with_speaker_n_turns_gives_speaker_labels(client: TestClient) -> None:
    for prefix in ("04", "07"):
        intake = upload(client, new_opportunity(client), prefix)

        assert labels(intake)[:2] == ["Speaker 1", "Speaker 2"]
        assert intake["turns"][0]["text"].startswith(("Okay, I think", "—okay"))


def test_an_srt_gives_name_cues_as_speakers(client: TestClient) -> None:
    srt = (
        "1\n00:00:01,000 --> 00:00:03,000\nAnna Agent: Thanks for coming in.\n\n"
        "2\n00:00:03,500 --> 00:00:05,000\nBen Buyer: Happy to be here.\n"
    )

    intake = upload_text(client, new_opportunity(client), "call.srt", srt)

    assert labels(intake) == ["Anna Agent", "Ben Buyer"]
    assert intake["turns"][1]["text"] == "Happy to be here."
    assert intake["turns"][1]["time"] == "00:03"


def test_a_markdown_transcript_with_speaker_headings_is_read_like_a_txt(client: TestClient) -> None:
    md = "Speaker 1  0:01\nHello there.\n\nSpeaker 2  0:04\nHi.\n"

    intake = upload_text(client, new_opportunity(client), "call.md", md)

    assert labels(intake) == ["Speaker 1", "Speaker 2"]


def test_notes_with_no_speaker_labels_count_as_the_agents_lines(client: TestClient) -> None:
    filename, text = transcript("05")

    intake = upload_text(client, new_opportunity(client), filename, text)

    assert labels(intake) == ["notes (agent)"]
    assert intake["speakers"][0]["match"] == {
        "kind": "agent",
        "name": "",
        "role": "",
        "person_id": None,
        "is_new": False,
        "guessed": True,
    }
    assert intake["source"]["kind"] == "notes"


def test_pasted_notes_are_accepted_without_a_file_name(client: TestClient) -> None:
    intake = upload_text(client, new_opportunity(client), "pasted notes", "Wants 3 beds.\nBudget 800k.", notes=True)

    assert labels(intake) == ["notes (agent)"]
    assert [t["text"] for t in intake["turns"]] == ["Wants 3 beds.", "Budget 800k."]


def test_the_upload_says_only_synthetic_or_role_play_material_may_be_used(
    client: TestClient,
) -> None:
    intake = upload(client, new_opportunity(client))

    assert "synthetic" in intake["notice"].lower()
    assert "role-play" in intake["notice"].lower()


def test_suggestions_that_fail_the_contract_or_the_quote_check_are_dropped_and_counted(
    client: TestClient,
) -> None:
    intake = upload(client, new_opportunity(client))

    assert intake["dropped_count"] == 3
    reasons = {d["id"]: d["reason"] for d in intake["dropped"]}
    assert reasons["d-ceiling910"].startswith("Quote not found word for word")
    assert reasons["d-bathrooms"] == (
        f"Quote found, but “{NADIA}” said it, not “{TASH}”"
    )
    assert "not on the agreed field list" in reasons["d-income"]


def test_suggestions_stay_hidden_until_every_speaker_is_matched(client: TestClient) -> None:
    intake = upload(client, new_opportunity(client))

    assert intake["queue"] == []
    refused = client.post(f"/api/v1/intakes/{intake['id']}/speakers/confirm")
    assert refused.status_code == 409
    assert "Match every speaker first" in refused.json()["detail"]
    assert client.get(f"/api/v1/intakes/{intake['id']}").json()["queue"] == []


def test_exactly_one_speaker_must_be_the_agent_before_review(client: TestClient) -> None:
    intake = upload(client, new_opportunity(client))
    for label, name in ((NADIA, "Nadia"), (TASH, "Tash"), (RHYS, "Rhys"), (DAN, "Dan")):
        match(client, intake["id"], label, "household", name)

    refused = client.post(f"/api/v1/intakes/{intake['id']}/speakers/confirm")

    assert refused.status_code == 409
    assert "which speaker is you" in refused.json()["detail"]


def test_a_speaker_is_matched_to_an_existing_client_and_the_match_is_remembered(
    client: TestClient,
) -> None:
    engagement_id = new_opportunity(client)
    existing = client.get(f"/api/v1/engagements/{engagement_id}").json()["clients"][0]
    intake = upload(client, engagement_id)

    matched = match(client, intake["id"], TASH, "household", "Tash Kumar", person_id=existing["id"])

    tash = next(s for s in matched["speakers"] if s["label"] == TASH)
    assert tash["match"]["person_id"] == existing["id"]
    assert tash["match"]["is_new"] is False
    assert tash["match"]["guessed"] is False


def test_a_speaker_whose_label_is_a_clients_name_is_guessed_but_needs_confirming(
    client: TestClient,
) -> None:
    intake = upload(client, new_opportunity(client))

    tash = next(s for s in intake["speakers"] if s["label"] == TASH)
    assert tash["match"]["kind"] == "household"
    assert tash["match"]["guessed"] is True


def test_matching_shows_what_each_match_unlocks(client: TestClient) -> None:
    intake = upload(client, new_opportunity(client))

    dan = next(s for s in intake["speakers"] if s["label"] == DAN)
    # Seven of the speaker's recorded statements are facts or profile items; four of those are finance facts.
    assert dan["unlocks"]["household"] == (
        "As a client: 7 statements become buyer requirements or profile facts."
    )
    assert dan["unlocks"]["professional"].startswith("As a professional: 4 statements")
    assert dan["unlocks"]["agent"].startswith("As you:")


def test_matching_a_professional_sounding_speaker_as_a_client_shows_a_warning(
    client: TestClient,
) -> None:
    intake = upload(client, new_opportunity(client))

    wrongly = match(client, intake["id"], DAN, "household", "Dan", is_new=True)
    rightly = match(client, intake["id"], DAN, "professional", "Dan", role="Mortgage broker")

    assert "borrowing" in next(s for s in wrongly["speakers"] if s["label"] == DAN)["warning"]
    assert next(s for s in rightly["speakers"] if s["label"] == DAN)["warning"] is None
    assert next(s for s in wrongly["speakers"] if s["label"] == TASH)["warning"] is None


def test_selecting_a_quote_can_find_its_turn_because_each_quote_carries_its_cue(
    client: TestClient,
) -> None:
    engagement_id = new_opportunity(client)
    intake = upload(client, engagement_id)
    for label, kind, name in ((NADIA, "agent", "Nadia"), (TASH, "household", "Tash"), (RHYS, "household", "Rhys"), (DAN, "professional", "Dan")):
        match(client, intake["id"], label, kind, name)

    review = client.post(f"/api/v1/intakes/{intake['id']}/speakers/confirm").json()

    pets = next(item for item in review["queue"] if item["id"] == "s-pets")
    cue = pets["quotes"][0]["cue"]
    assert review["turns"][cue]["text"].startswith("We've got a cat")
    assert review["turns"][cue]["speaker"] == TASH


def test_the_intake_and_its_speaker_matches_survive_a_restart(app_client: ClientFactory) -> None:
    first = app_client()
    intake = upload(first, new_opportunity(first))
    match(first, intake["id"], DAN, "professional", "Dan", role="Mortgage broker")

    restarted = app_client()
    reread = restarted.get(f"/api/v1/intakes/{intake['id']}").json()

    dan = next(s for s in reread["speakers"] if s["label"] == DAN)
    assert dan["match"]["kind"] == "professional"
    assert reread["dropped_count"] == 3


def test_an_intake_belongs_to_its_agency(client: TestClient, app_client: ClientFactory, another_agency) -> None:  # type: ignore[no-untyped-def]
    intake = upload(client, new_opportunity(client))

    elsewhere = app_client(another_agency)

    assert elsewhere.get(f"/api/v1/intakes/{intake['id']}").status_code == 404
    assert app_client(None).get(f"/api/v1/intakes/{intake['id']}").status_code == 403


def test_the_scripted_extractor_replays_the_answer_key_for_every_other_synthetic_transcript(
    client: TestClient,
) -> None:
    for prefix in ("01", "02", "04", "05", "06", "07"):
        intake = upload(client, new_opportunity(client), prefix)

        assert intake["extraction_note"] is None, prefix
        assert intake["dropped_count"] == 0, prefix
        assert any(
            "become buyer requirements or profile facts" in s["unlocks"]["household"]
            and not s["unlocks"]["household"].startswith("As a client: 0 ")
            for s in intake["speakers"]
        ), prefix
