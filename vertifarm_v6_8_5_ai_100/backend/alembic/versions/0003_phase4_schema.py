"""Phase 4 — Ecosystem: Resellers, Compliance, Franchise

Revision ID: 0003
Revises: 0002
Create Date: 2027-01-01 00:00:00.000000

NOTE: All Phase 4 tables (resellers, reseller_clients, reseller_commissions,
certifications, compliance_documents, franchise_groups, franchise_sites,
franchise_recipe_pushes, franchise_config_pushes) are created by init_db.py
via Base.metadata.create_all() before this migration runs.
This migration is a no-op placeholder matching the pattern of 0001/0002.
"""
from alembic import op
import sqlalchemy as sa

revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables already created by init_db.py (Base.metadata.create_all).
    pass


def downgrade() -> None:
    # To undo Phase 4 tables manually if needed:
    # op.drop_table('franchise_config_pushes')
    # op.drop_table('franchise_recipe_pushes')
    # op.drop_table('franchise_sites')
    # op.drop_table('franchise_groups')
    # op.drop_table('compliance_documents')
    # op.drop_table('certifications')
    # op.drop_table('reseller_commissions')
    # op.drop_table('reseller_clients')
    # op.drop_table('resellers')
    pass
