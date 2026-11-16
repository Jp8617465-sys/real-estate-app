"""Create the local database, the restricted application role, and apply migrations.

Run as `python -m buyers_desk.provision [database]`. Safe to repeat.
"""
import sys
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from buyers_desk.settings import APP_ROLE, Settings

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


def provision(database: str, *, recreate: bool = False) -> None:
    settings = Settings(database=database)
    admin = create_engine("postgresql+psycopg:///postgres", isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        has_role = conn.execute(
            text("SELECT 1 FROM pg_roles WHERE rolname = :n"), {"n": APP_ROLE}
        ).first()
        if not has_role:
            conn.execute(text(f"CREATE ROLE {APP_ROLE} LOGIN NOSUPERUSER NOBYPASSRLS"))
        if recreate:
            conn.execute(text(f'DROP DATABASE IF EXISTS "{database}" WITH (FORCE)'))
        has_db = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :n"), {"n": database}
        ).first()
        if not has_db:
            conn.execute(text(f'CREATE DATABASE "{database}"'))
    admin.dispose()

    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS))
    config.set_main_option("sqlalchemy.url", settings.owner_url.replace("%", "%%"))
    command.upgrade(config, "head")


if __name__ == "__main__":
    provision(sys.argv[1] if len(sys.argv) > 1 else Settings().database)
