"""Properties, their place in an engagement (status, assessment) and checks against the brief.

Revision ID: 0007
Revises: 0006
"""
from alembic import op

revision = "0007"
down_revision = "0006"

CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"
TABLES = ("properties", "engagement_properties", "property_checks")


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE properties (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            address_line text NOT NULL CHECK (address_line <> ''),
            suburb text, state text, postcode text, property_type text,
            bedrooms int, bathrooms int, parking int, land_m2 int,
            price_guide_low bigint, price_guide_high bigint,
            listing_url text, notes text,
            source text NOT NULL DEFAULT 'Entered by hand',
            created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE engagement_properties (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_id uuid NOT NULL REFERENCES engagements (id),
            property_id uuid NOT NULL REFERENCES properties (id),
            status text NOT NULL DEFAULT 'considering' CHECK (status IN
                ('considering', 'shortlisted', 'inspecting', 'held', 'offered', 'purchased', 'passed', 'missed')),
            assessment text, reasons text,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (engagement_id, property_id)
        );
        CREATE TABLE property_checks (
            id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
            agency_id uuid NOT NULL REFERENCES agencies (id),
            engagement_property_id uuid NOT NULL REFERENCES engagement_properties (id),
            criterion text NOT NULL CHECK (criterion <> ''),
            result text NOT NULL CHECK (result IN ('meets', 'partly', 'fails', 'unknown')),
            note text,
            created_at timestamptz NOT NULL DEFAULT now(),
            UNIQUE (engagement_property_id, criterion)
        );
        GRANT SELECT, INSERT, UPDATE ON properties, engagement_properties, property_checks TO buyers_desk_app;
        """
    )
    for table in TABLES:
        op.execute(
            f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY agency_only ON {table}
                USING (agency_id = {CURRENT_AGENCY}) WITH CHECK (agency_id = {CURRENT_AGENCY});
            """
        )
