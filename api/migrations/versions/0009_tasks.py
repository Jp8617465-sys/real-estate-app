"""Tasks with an owner and a due date.

Revision ID: 0009
Revises: 0008
"""
from alembic import op

revision = "0009"
down_revision = "0008"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE tasks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid REFERENCES engagements (id),
            person_id uuid REFERENCES persons (id),
            title text NOT NULL CHECK (title <> ''),
            owner text NOT NULL DEFAULT 'Agent',
            due_on date,
            due_text text,
            done_at timestamptz,
            source_value_id uuid UNIQUE REFERENCES record_values (id),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX tasks_open ON tasks (due_on) WHERE done_at IS NULL;
        GRANT SELECT, INSERT, UPDATE ON tasks TO buyers_desk_app;
        """
    )
    op.execute(
        f"""
        ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agency_only ON tasks
            USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
        """
    )
