"""A record is committed before the response that reports it is delivered, so a fast client's very next
request always sees it. Only a real server shows this: the in-process test client waits for the whole
request to finish. Found when `make demo` failed to seed with "No such person"."""
import socket
import threading
import time
from collections.abc import Iterator

import httpx2 as httpx
import pytest
import uvicorn

from buyers_desk.app import create_app
from buyers_desk.settings import Settings


@pytest.fixture
def live_server(settings: Settings) -> Iterator[str]:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        port = s.getsockname()[1]
    server = uvicorn.Server(uvicorn.Config(create_app(settings), host="127.0.0.1", port=port, log_level="error"))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    while not server.started:
        time.sleep(0.05)
    yield f"http://127.0.0.1:{port}"
    server.should_exit = True
    thread.join(timeout=5)


def test_the_next_request_always_sees_what_the_previous_one_created(live_server: str) -> None:
    with httpx.Client(base_url=live_server, timeout=30) as client:
        for n in range(150):
            person = client.post("/api/v1/people", json={"name": f"Person {n}", "email": f"p{n}@example.com"})
            assert person.status_code == 201
            household = client.post("/api/v1/households", json={"name": f"Household {n}", "member_ids": [person.json()["id"]]})
            assert household.status_code == 201, f"round {n}: {household.text}"
            assert client.get(f"/api/v1/households/{household.json()['id']}").status_code == 200
