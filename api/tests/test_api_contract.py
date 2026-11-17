"""Slice 7: the documented, versioned product API. Pagination, consistent errors, idempotent
creates, and token authentication for external callers. Observed over HTTP; synthetic material only."""
from collections.abc import Callable, Iterator
from typing import Any
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from buyers_desk.app import create_app
from buyers_desk.settings import LOCAL_AGENCY_ID, Settings
from tests.conftest import ClientFactory
from tests.helpers import new_opportunity

V1 = "/api/v1"


@pytest.fixture
def with_tokens(settings: Settings) -> Iterator[Callable[..., TestClient]]:
    started: list[TestClient] = []

    def start(*tokens: str) -> TestClient:
        c = TestClient(create_app(Settings(database=settings.database, agency_id=LOCAL_AGENCY_ID, api_tokens=tokens)))
        c.__enter__()
        started.append(c)
        return c

    yield start
    for c in started:
        c.__exit__(None, None, None)


def test_the_api_describes_itself_and_has_an_open_health_check(client: TestClient) -> None:
    info = client.get(V1).json()
    health = client.get(f"{V1}/health")

    assert info["version"] == "v1" and info["openapi_url"] == "/openapi.json" and info["auth"] == "none"
    assert health.status_code == 200 and health.json() == {"status": "ok"}
    spec = client.get("/openapi.json").json()
    assert spec["info"]["title"] == "Buyers desk API"
    assert all(p.startswith(f"{V1}") for p in spec["paths"])
    assert "bearerAuth" in spec["components"]["securitySchemes"]


def test_lists_are_paged_with_a_total_count_and_a_sane_limit(client: TestClient) -> None:
    for n in range(5):
        client.post(f"{V1}/people", json={"name": f"Person {n}", "email": f"p{n}@example.com"})

    page = client.get(f"{V1}/people", params={"limit": 2, "offset": 2})

    assert page.status_code == 200 and len(page.json()) == 2
    assert page.headers["X-Total-Count"] == "5"
    assert [p["name"] for p in page.json()] == ["Person 2", "Person 3"]
    assert len(client.get(f"{V1}/people").json()) == 5
    assert client.get(f"{V1}/people", params={"limit": 500}).status_code == 422
    assert client.get(f"{V1}/people", params={"offset": -1}).status_code == 422
    for path in ("households", "properties", "professionals", "tasks", "engagements"):
        listed = client.get(f"{V1}/{path}", params={"limit": 1})
        assert listed.status_code == 200 and "X-Total-Count" in listed.headers, path


def test_every_error_has_a_stable_code_beside_its_detail(client: TestClient) -> None:
    missing = client.get(f"{V1}/people/{UUID(int=9)}")
    conflict = client.post(f"{V1}/people", json={"name": "A", "email": "a@example.com"})
    clash = client.post(f"{V1}/people", json={"name": "A2", "email": "a@example.com"})
    invalid = client.post(f"{V1}/people", json={})

    assert conflict.status_code == 201
    assert (missing.status_code, missing.json()["code"], missing.json()["detail"]) == (404, "not_found", "No such person")
    assert (clash.status_code, clash.json()["code"]) == (409, "conflict")
    assert (invalid.status_code, invalid.json()["code"]) == (422, "validation_error") and invalid.json()["detail"]


def test_a_repeated_create_with_the_same_idempotency_key_is_replayed_not_repeated(client: TestClient) -> None:
    headers = {"Idempotency-Key": "enquiry-123"}
    body = {"name": "Ada Lovelace", "email": "ada@example.com"}

    first = client.post(f"{V1}/people", json=body, headers=headers)
    again = client.post(f"{V1}/people", json=body, headers=headers)

    assert first.status_code == again.status_code == 201
    assert again.json() == first.json() and again.headers["Idempotent-Replay"] == "true"
    assert "Idempotent-Replay" not in first.headers
    assert len(client.get(f"{V1}/people").json()) == 1


def test_an_idempotency_key_reused_for_a_different_request_is_refused(client: TestClient) -> None:
    headers = {"Idempotency-Key": "k1"}
    client.post(f"{V1}/people", json={"name": "Ada", "email": "ada@example.com"}, headers=headers)

    reused = client.post(f"{V1}/people", json={"name": "Someone Else", "email": "else@example.com"}, headers=headers)

    assert reused.status_code == 422 and reused.json()["code"] == "idempotency_key_reuse"
    assert len(client.get(f"{V1}/people").json()) == 1


def test_a_key_is_kept_across_a_restart_and_does_not_cross_agencies(app_client: ClientFactory, another_agency: Any) -> None:
    headers = {"Idempotency-Key": "k-restart"}
    first = app_client().post(f"{V1}/people", json={"name": "Ada", "email": "ada@example.com"}, headers=headers)

    again = app_client().post(f"{V1}/people", json={"name": "Ada", "email": "ada@example.com"}, headers=headers)
    other = app_client(another_agency).post(f"{V1}/people", json={"name": "Ada", "email": "ada@example.com"}, headers=headers)

    assert again.json() == first.json() and again.headers["Idempotent-Replay"] == "true"
    assert other.status_code == 201 and other.json()["id"] != first.json()["id"] and "Idempotent-Replay" not in other.headers


def test_with_tokens_configured_every_call_needs_a_valid_bearer_token_except_health(with_tokens: Callable[..., TestClient]) -> None:
    api = with_tokens("secret-one", "secret-two")

    none = api.get(f"{V1}/people")
    wrong = api.get(f"{V1}/people", headers={"Authorization": "Bearer nope"})
    right = api.get(f"{V1}/people", headers={"Authorization": "Bearer secret-two"})

    assert (none.status_code, none.json()["code"]) == (401, "unauthorized") and none.headers["WWW-Authenticate"] == "Bearer"
    assert wrong.status_code == 401 and right.status_code == 200
    assert api.get(f"{V1}/health").status_code == 200
    assert api.get(V1).json()["auth"] == "bearer"


def test_without_tokens_the_local_app_works_as_before(client: TestClient) -> None:
    new_opportunity(client)  # the same single-user path the app uses

    assert client.get(f"{V1}/engagements").status_code == 200
