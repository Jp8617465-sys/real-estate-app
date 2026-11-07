"""Test harness: a real local PostgreSQL test database, migrated by Alembic, behind the real API."""
from collections.abc import Callable, Iterator
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from buyers_desk.app import create_app
from buyers_desk.provision import provision
from buyers_desk.settings import LOCAL_AGENCY_ID, Settings

TEST_DATABASE = "buyers_desk_test"

ClientFactory = Callable[..., TestClient]


@pytest.fixture(scope="session")
def settings() -> Settings:
    provision(TEST_DATABASE, recreate=True)
    return Settings(database=TEST_DATABASE)


@pytest.fixture(autouse=True)
def clean_database(settings: Settings) -> Iterator[None]:
    """Each test starts with only the seeded local agency."""
    engine = create_engine(settings.owner_url)
    with engine.begin() as conn:
        tables = conn.execute(
            text(
                "SELECT tablename FROM pg_tables WHERE schemaname = 'public' "
                "AND tablename NOT IN ('agencies', 'alembic_version')"
            )
        ).scalars().all()
        if tables:
            conn.execute(text("TRUNCATE " + ", ".join(f'"{t}"' for t in tables) + " CASCADE"))
        conn.execute(text("DELETE FROM agencies WHERE id <> :id"), {"id": LOCAL_AGENCY_ID})
    engine.dispose()
    yield


@pytest.fixture
def app_client(settings: Settings) -> Iterator[ClientFactory]:
    """Start the app, as `make run` would. Call again to simulate a restart."""
    started: list[TestClient] = []

    def start(agency_id: UUID | None = LOCAL_AGENCY_ID) -> TestClient:
        client = TestClient(create_app(Settings(database=settings.database, agency_id=agency_id)))
        client.__enter__()
        started.append(client)
        return client

    yield start
    for client in started:
        client.__exit__(None, None, None)


@pytest.fixture
def client(app_client: ClientFactory) -> TestClient:
    return app_client()


@pytest.fixture
def another_agency(settings: Settings) -> UUID:
    agency_id = uuid4()
    engine = create_engine(settings.owner_url)
    with engine.begin() as conn:
        conn.execute(
            text("INSERT INTO agencies (id, name) VALUES (:id, 'Another agency')"),
            {"id": agency_id},
        )
    engine.dispose()
    return agency_id
