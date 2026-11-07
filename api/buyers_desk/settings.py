"""Runtime configuration. Everything is local for the tracer bullet: one machine, one agency."""
import os
import re
from dataclasses import dataclass, field
from uuid import UUID

# The agency seeded by the first migration. Single-user local app: no logins (see the spec).
LOCAL_AGENCY_ID = UUID("00000000-0000-4000-8000-000000000001")
APP_ROLE = "buyers_desk_app"


def _database_from_env() -> str:
    return os.environ.get("BUYERS_DESK_DB", "buyers_desk")


@dataclass(frozen=True)
class Settings:
    database: str = field(default_factory=_database_from_env)
    # None means "no agency": the API refuses to read or write anything (ADR 0002).
    agency_id: UUID | None = LOCAL_AGENCY_ID

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[a-z_][a-z0-9_]*", self.database):
            raise ValueError(f"unsafe database name: {self.database!r}")

    @property
    def owner_url(self) -> str:
        """Migrations and provisioning connect as the local operating-system user."""
        return f"postgresql+psycopg:///{self.database}"

    @property
    def app_url(self) -> str:
        """The running app connects as a restricted role, so row-level security applies to it."""
        return f"postgresql+psycopg://{APP_ROLE}@/{self.database}"
