"""Phase 2 — API Portal, Notifications, Traceability, Integrations

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-28 00:00:00.000000

NOTE: All Phase 2 tables (webhook_endpoints, webhook_deliveries, notifications,
notification_preferences, escalation_rules, traceability_records, integrations)
are created by init_db.py via Base.metadata.create_all() before this migration
runs. This migration is therefore a no-op placeholder — matching the pattern
used by 0001_initial_schema — so `alembic upgrade head` succeeds cleanly.
"""
from alembic import op
import sqlalchemy as sa

revision = '0002'
down_revision = '0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables already created by init_db.py (Base.metadata.create_all).
    # Nothing to do here.
    pass


def downgrade() -> None:
    # To undo Phase 2 tables manually if needed:
    # op.drop_table('integrations')
    # op.drop_table('traceability_records')
    # op.drop_table('escalation_rules')
    # op.drop_table('notification_preferences')
    # op.drop_table('notifications')
    # op.drop_table('webhook_deliveries')
    # op.drop_table('webhook_endpoints')
    pass
