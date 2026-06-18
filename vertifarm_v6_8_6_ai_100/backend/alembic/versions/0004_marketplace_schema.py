"""Feature 12 — Multi-Farm Marketplace: buyers, listings, orders, escrow

Revision ID: 0004
Revises: 0003
Create Date: 2027-01-01 00:00:00.000000

NOTE: All Phase 4 tables are created by init_db.py via Base.metadata.create_all().
This migration is a no-op placeholder matching the project pattern.
"""
from alembic import op
import sqlalchemy as sa

revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tables auto-created by init_db.py (Base.metadata.create_all).
    # New tables in this revision:
    #   marketplace_buyers
    #   produce_listings
    #   marketplace_orders
    #   marketplace_escrows
    pass


def downgrade() -> None:
    # To manually drop marketplace tables:
    # op.drop_table('marketplace_escrows')
    # op.drop_table('marketplace_orders')
    # op.drop_table('produce_listings')
    # op.drop_table('marketplace_buyers')
    pass
