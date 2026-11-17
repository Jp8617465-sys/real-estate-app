"""A communications log per engagement, and identity checks per person.

Revision ID: 0011
Revises: 0010
"""
from alembic import op

revision = "0011"
down_revision = "0010"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE communications (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            direction text NOT NULL CHECK (direction IN ('in', 'out')),
            channel text NOT NULL CHECK (channel IN ('email', 'call', 'sms', 'note')),
            subject text NOT NULL, body text,
            occurred_at timestamptz NOT NULL DEFAULT now(),
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE identity_checks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            person_id uuid NOT NULL REFERENCES persons (id),
            kind text NOT NULL CHECK (kind IN ('customer_identification', 'sanctions_pep')),
            status text NOT NULL CHECK (status IN ('passed', 'needs_review', 'failed')),
            provider text NOT NULL, reference text NOT NULL,
            evidence jsonb NOT NULL, synthetic boolean NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        GRANT SELECT, INSERT ON communications, identity_checks TO buyers_desk_app;
        """
    )
    for table in ("communications", "identity_checks"):
        op.execute(
            f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY agency_only ON {table}
                USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
            """
        )
