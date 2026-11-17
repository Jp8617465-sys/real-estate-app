"""Idempotency keys: a repeated create with the same key is replayed, not repeated.

Revision ID: 0010
Revises: 0009
"""
from alembic import op

revision = "0010"
down_revision = "0009"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE idempotency_keys (
            agency_id uuid NOT NULL REFERENCES agencies (id),
            key text NOT NULL,
            request_hash text NOT NULL,
            status_code int NOT NULL,
            response_body text NOT NULL,
            content_type text NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            PRIMARY KEY (agency_id, key)
        );
        GRANT SELECT, INSERT ON idempotency_keys TO buyers_desk_app;
        """
    )
    op.execute(
        f"""
        ALTER TABLE idempotency_keys ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agency_only ON idempotency_keys
            USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
        """
    )
