"""Append-only change log: who changed what, from what, to what, and from which source (ADR 0003).

Revision ID: 0002
Revises: 0001
"""
from alembic import op

revision = "0002"
down_revision = "0001"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE change_log (
            id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            agency_id uuid NOT NULL REFERENCES agencies (id),
            entity text NOT NULL,
            entity_id uuid NOT NULL,
            field text NOT NULL,
            new_value jsonb NOT NULL,
            earlier_value jsonb,
            source jsonb NOT NULL,
            changed_by text NOT NULL,
            changed_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX change_log_entity ON change_log (entity, entity_id);

        -- Append-only: the app role can add entries but never alter or remove them.
        GRANT SELECT, INSERT ON change_log TO buyers_desk_app;
        """
    )
