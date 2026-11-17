"""Pipeline: when an engagement entered its stage, and why it was closed.

Revision ID: 0006
Revises: 0005
"""
from alembic import op

revision = "0006"
down_revision = "0005"


def upgrade() -> None:
    op.execute(
        """
        ALTER TABLE engagements
            ADD COLUMN stage_changed_at timestamptz NOT NULL DEFAULT now(),
            ADD COLUMN closed_reason text;
        """
    )
