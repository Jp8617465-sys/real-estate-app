"""Core records for a buying opportunity: agency, people, households, engagements, brief.

Revision ID: 0001
Revises:
"""
from alembic import op

revision = "0001"
down_revision = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE agencies (
            id uuid PRIMARY KEY,
            name text NOT NULL
        );
        INSERT INTO agencies (id, name)
            VALUES ('00000000-0000-4000-8000-000000000001', 'Local agency');

        CREATE TABLE persons (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            name text NOT NULL CHECK (name <> ''),
            email text,
            mobile text,
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE households (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            name text NOT NULL CHECK (name <> ''),
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE household_members (
            agency_id uuid NOT NULL REFERENCES agencies (id),
            household_id uuid NOT NULL REFERENCES households (id),
            person_id uuid NOT NULL REFERENCES persons (id),
            PRIMARY KEY (household_id, person_id)
        );

        CREATE TABLE engagements (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            service_line text NOT NULL CHECK (service_line IN ('buying')),
            stage text NOT NULL,
            household_id uuid NOT NULL REFERENCES households (id),
            created_at timestamptz NOT NULL DEFAULT now()
        );

        CREATE TABLE engagement_clients (
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            person_id uuid NOT NULL REFERENCES persons (id),
            PRIMARY KEY (engagement_id, person_id)
        );

        CREATE TABLE buyer_briefs (
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid PRIMARY KEY REFERENCES engagements (id),
            budget_aud bigint CHECK (budget_aud > 0)
        );

        -- The running app is a restricted role: it can read, add and change, never delete (ADR 0003).
        GRANT SELECT ON agencies TO buyers_desk_app;
        GRANT SELECT, INSERT, UPDATE ON persons, households, household_members,
            engagements, engagement_clients, buyer_briefs TO buyers_desk_app;
        """
    )
