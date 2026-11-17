"""Dated household membership, typed relationships, and mobile matching.

Revision ID: 0005
Revises: 0004
"""
from alembic import op

revision = "0005"
down_revision = "0004"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE household_members
            ADD COLUMN started_on date NOT NULL DEFAULT current_date,
            ADD COLUMN ended_on date;

        -- Australian mobiles compared by digits: "+61 400 111 222" equals "0400 111 222".
        CREATE FUNCTION normalize_mobile(m text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
            SELECT CASE WHEN d LIKE '61%' AND length(d) >= 11 THEN '0' || substr(d, 3) ELSE d END
            FROM (SELECT regexp_replace(coalesce(m, ''), '\\D', '', 'g') AS d) s
        $$;

        -- kind says what other_person is to person: parent means "other is person's parent".
        CREATE TABLE relationships (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            person_id uuid NOT NULL REFERENCES persons (id),
            other_person_id uuid NOT NULL REFERENCES persons (id),
            kind text NOT NULL CHECK (kind IN ('partner', 'parent', 'sibling', 'other')),
            note text,
            created_at timestamptz NOT NULL DEFAULT now(),
            CHECK (person_id <> other_person_id),
            UNIQUE (person_id, other_person_id, kind)
        );
        GRANT SELECT, INSERT ON relationships TO buyers_desk_app;
        """
    )
    op.execute(
        f"""
        ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
        CREATE POLICY agency_only ON relationships
            USING (agency_id = {CURRENT_AGENCY})
            WITH CHECK (agency_id = {CURRENT_AGENCY});
        """
    )
