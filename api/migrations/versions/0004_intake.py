"""Discovery-call intakes, the values they record, and professionals on an engagement.

Revision ID: 0004
Revises: 0003
"""
from alembic import op

revision = "0004"
down_revision = "0003"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE intakes (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            filename text NOT NULL,
            source_kind text NOT NULL CHECK (source_kind IN ('transcript', 'notes')),
            extractor text NOT NULL,
            turns jsonb NOT NULL,
            state jsonb NOT NULL,
            review_started_at timestamptz,
            review_seconds integer,
            applied_at timestamptz,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        -- What the agent accepted from a call. A "one" field has a single current value; its
        -- earlier values stay here (current = false) and in the change log.
        CREATE TABLE record_values (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            intake_id uuid REFERENCES intakes (id),
            section text NOT NULL,
            field text NOT NULL,
            subject text,
            value text NOT NULL CHECK (value <> ''),
            status text NOT NULL,
            basis text,
            quotes jsonb NOT NULL DEFAULT '[]',
            source jsonb NOT NULL,
            extra jsonb NOT NULL DEFAULT '{}',
            current boolean NOT NULL DEFAULT true,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX record_values_engagement ON record_values (engagement_id, section, field);

        CREATE TABLE engagement_professionals (
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            person_id uuid NOT NULL REFERENCES persons (id),
            role text NOT NULL,
            PRIMARY KEY (engagement_id, person_id)
        );

        GRANT SELECT, INSERT, UPDATE ON intakes, record_values TO buyers_desk_app;
        GRANT SELECT, INSERT ON engagement_professionals TO buyers_desk_app;
        """
    )
    for table in ("intakes", "record_values", "engagement_professionals"):
        op.execute(
            f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY agency_only ON {table}
                USING (agency_id = {CURRENT_AGENCY})
                WITH CHECK (agency_id = {CURRENT_AGENCY});
            """
        )
