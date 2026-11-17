"""Shared by the intake API tests: synthetic opportunity, transcripts from testdata, speaker labels."""
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

TESTDATA = Path(__file__).resolve().parents[2] / "testdata" / "intake-consultations"

NADIA = "Nadia Pearce | Halyard Buyers Advocacy"
TASH = "Tash Kumar"
RHYS = "Rhys Gallagher"
DAN = "iPhone (2)"

KUMAR_GALLAGHER = {
    "household_name": "Tash and Rhys (synthetic)",
    "client": {"name": "Tash Kumar", "mobile": "0400 000 001"},
    "budget_aud": 950_000,
}


def transcript(prefix: str) -> tuple[str, str]:
    path = next(TESTDATA.glob(f"{prefix}-*"))
    return path.name, path.read_text(encoding="utf-8")


def new_opportunity(client: TestClient, body: dict[str, Any] | None = None) -> str:
    created = client.post("/api/v1/engagements", json=body or KUMAR_GALLAGHER)
    assert created.status_code == 201
    return str(created.json()["id"])


def upload(client: TestClient, engagement_id: str, prefix: str = "03") -> dict[str, Any]:
    filename, text = transcript(prefix)
    return upload_text(client, engagement_id, filename, text)


def upload_text(
    client: TestClient, engagement_id: str, filename: str, text: str, notes: bool = False
) -> dict[str, Any]:
    response = client.post(
        f"/api/v1/engagements/{engagement_id}/intakes",
        json={"filename": filename, "text": text, "notes": notes},
    )
    assert response.status_code == 201, response.text
    body: dict[str, Any] = response.json()
    return body


def match(
    client: TestClient, intake_id: str, label: str, kind: str, name: str, **extra: Any
) -> dict[str, Any]:
    response = client.put(
        f"/api/v1/intakes/{intake_id}/speakers", json={"label": label, "kind": kind, "name": name, **extra}
    )
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def match_call_03(client: TestClient, intake_id: str, dan_as: str = "professional") -> None:
    match(client, intake_id, NADIA, "agent", "Nadia Pearce")
    match(client, intake_id, TASH, "household", "Tash Kumar")
    match(client, intake_id, RHYS, "household", "Rhys Gallagher", is_new=True)
    if dan_as == "household":
        match(client, intake_id, DAN, "household", "Dan", is_new=True)
    else:
        match(client, intake_id, DAN, "professional", "Dan", role="Mortgage broker")


def confirm(client: TestClient, intake_id: str) -> dict[str, Any]:
    response = client.post(f"/api/v1/intakes/{intake_id}/speakers/confirm")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body


def open_review_03(client: TestClient, dan_as: str = "professional") -> tuple[str, str]:
    engagement_id = new_opportunity(client)
    intake = upload(client, engagement_id)
    match_call_03(client, intake["id"], dan_as)
    confirm(client, intake["id"])
    return engagement_id, str(intake["id"])


def item(view: dict[str, Any], suggestion_id: str) -> dict[str, Any]:
    found: dict[str, Any] = next(i for i in view["queue"] if i["id"] == suggestion_id)
    return found


def ids(view: dict[str, Any], bucket: str) -> list[str]:
    return [i["id"] for i in view["queue"] if i["bucket"] == bucket]


def decide(client: TestClient, intake_id: str, kind: str, suggestion_id: str, value: str | None = None) -> Any:
    return client.post(
        f"/api/v1/intakes/{intake_id}/decisions", json={"type": kind, "id": suggestion_id, "value": value}
    )


def decided(client: TestClient, intake_id: str, kind: str, *suggestion_ids: str) -> dict[str, Any]:
    view: dict[str, Any] = {}
    for suggestion_id in suggestion_ids:
        response = decide(client, intake_id, kind, suggestion_id)
        assert response.status_code == 200, f"{kind} {suggestion_id}: {response.text}"
        view = response.json()
    return view


def read(client: TestClient, intake_id: str) -> dict[str, Any]:
    body: dict[str, Any] = client.get(f"/api/v1/intakes/{intake_id}").json()
    return body


def record(client: TestClient, engagement_id: str) -> list[dict[str, Any]]:
    values: list[dict[str, Any]] = client.get(f"/api/v1/engagements/{engagement_id}/record").json()["values"]
    return values


def finish(client: TestClient, intake_id: str) -> dict[str, Any]:
    response = client.post(f"/api/v1/intakes/{intake_id}/finish")
    assert response.status_code == 200, response.text
    body: dict[str, Any] = response.json()
    return body
