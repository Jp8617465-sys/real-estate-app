"""The database itself confines every request to one agency (ADR 0002).

Row-level security applies to the restricted app role; the table owner (used by migrations
and tests) is exempt. A request that names no agency matches no rows and may not write.

Revision ID: 0003
Revises: 0002
"""
from alembic import op

revision = "0003"
down_revision = "0002"

AGENCY_OWNED = (
    "persons",
    "households",
    "household_members",
    "engagements",
    "engagement_clients",
    "buyer_briefs",
    "change_log",
)
CURRENT_AGENCY = "nullif(current_setting('app.agency_id', true), '')::uuid"


def upgrade() -> None:
    for table in AGENCY_OWNED:
        op.execute(
            f"""
            ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;
            CREATE POLICY agency_only ON {table}
                USING (agency_id = {CURRENT_AGENCY})
                WITH CHECK (agency_id = {CURRENT_AGENCY});
            """
        )
    op.execute(
        f"""
        ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
        CREATE POLICY own_agency_only ON agencies USING (id = {CURRENT_AGENCY});
        """
    )
