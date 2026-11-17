"""A professionals directory, and dated links between professionals and engagements.

Revision ID: 0008
Revises: 0007
"""
from alembic import op

revision = "0008"
down_revision = "0007"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE professionals (
            person_id uuid PRIMARY KEY REFERENCES persons (id),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            kind text NOT NULL DEFAULT 'other' CHECK (kind IN
                ('broker', 'selling_agent', 'conveyancer', 'solicitor', 'inspector', 'referrer', 'other')),
            firm text, notes text,
            created_at timestamptz NOT NULL DEFAULT now()
        );
        ALTER TABLE engagement_professionals
            ADD COLUMN started_on date NOT NULL DEFAULT current_date,
            ADD COLUMN ended_on date;

        -- Professionals already named in calls join the directory.
        INSERT INTO professionals (person_id, agency_id, kind)
        SELECT DISTINCT ON (person_id) person_id, agency_id,
            CASE WHEN lower(role) LIKE '%broker%' THEN 'broker'
                 WHEN lower(role) LIKE '%selling%' OR lower(role) LIKE '%agent%' THEN 'selling_agent'
                 WHEN lower(role) LIKE '%conveyanc%' THEN 'conveyancer'
                 WHEN lower(role) LIKE '%solicitor%' THEN 'solicitor'
                 WHEN lower(role) LIKE '%inspect%' THEN 'inspector'
                 WHEN lower(role) LIKE '%refer%' THEN 'referrer' ELSE 'other' END
        FROM engagement_professionals;

        GRANT SELECT, INSERT, UPDATE ON professionals TO buyers_desk_app;
        GRANT UPDATE ON engagement_professionals TO buyers_desk_app;
        """
    )
    op.execute(
        f"""
        ALTER TABLE professionals ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agency_only ON professionals
            USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
        """
    )
