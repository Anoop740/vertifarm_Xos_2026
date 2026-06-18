"""Initial schema

Revision ID: 0001
Revises: 
Create Date: 2026-05-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Let SQLAlchemy/init_db create all tables via Base.metadata.create_all
    # This migration is a no-op placeholder so `alembic upgrade head` succeeds
    pass


def downgrade() -> None:
    pass
