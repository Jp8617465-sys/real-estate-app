"""Feedback captured during the trial.

Revision ID: 0012
Revises: 0011
"""
from alembic import op

revision = "0012"
down_revision = "0011"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE feedback_notes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            author text NOT NULL DEFAULT '',
            area text NOT NULL DEFAULT '',
            note text NOT NULL CHECK (note <> ''),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        GRANT SELECT, INSERT ON feedback_notes TO buyers_desk_app;
        """
    )
    op.execute(
        f"""
        ALTER TABLE feedback_notes ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agency_only ON feedback_notes
            USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
        """
    )
