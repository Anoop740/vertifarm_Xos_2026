"""Add audit_logs table for enterprise event sourcing.

Adds a fully-indexed, append-only audit log table that records every
mutating action in VertiFarm XOS (auth, farms, zones, crops, billing,
team, compliance, AI, API keys, etc.).

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-11 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :t)"
    ), {"t": table_name})
    return result.scalar()


def _index_exists(conn, index_name: str) -> bool:
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": index_name})
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, "audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id",              sa.String,  primary_key=True),
            sa.Column("organization_id", sa.String,  sa.ForeignKey("organizations.id"), nullable=True),
            sa.Column("actor_id",        sa.String,  sa.ForeignKey("users.id"),         nullable=True),
            sa.Column("actor_email",     sa.String(255), nullable=True),
            sa.Column("actor_role",      sa.String(50),  nullable=True),
            sa.Column("event_type",      sa.String(100), nullable=False),
            sa.Column("event_category",  sa.String(50),  nullable=False),
            sa.Column("resource_type",   sa.String(80),  nullable=True),
            sa.Column("resource_id",     sa.String,      nullable=True),
            sa.Column("resource_name",   sa.String(200), nullable=True),
            sa.Column("before_state",    sa.JSON,        nullable=True),
            sa.Column("after_state",     sa.JSON,        nullable=True),
            sa.Column("delta",           sa.JSON,        nullable=True),
            sa.Column("metadata_json",   sa.JSON,        server_default="{}"),
            sa.Column("status",          sa.String(20),  server_default="success"),
            sa.Column("error_detail",    sa.Text,        nullable=True),
            sa.Column("ip_address",      sa.String(45),  nullable=True),
            sa.Column("user_agent",      sa.String(500), nullable=True),
            sa.Column("request_id",      sa.String(36),  nullable=True),
            sa.Column("created_at",      sa.DateTime(timezone=True),
                      server_default=sa.func.now(), nullable=False),
        )

    # Indexes — guarded individually so re-runs are safe
    indexes = [
        ("ix_audit_org_created",   "audit_logs", ["organization_id", "created_at"]),
        ("ix_audit_actor_created", "audit_logs", ["actor_id",        "created_at"]),
        ("ix_audit_event_created", "audit_logs", ["event_type",      "created_at"]),
        ("ix_audit_resource",      "audit_logs", ["resource_type",   "resource_id"]),
        ("ix_audit_request_id",    "audit_logs", ["request_id"]),
    ]
    for idx_name, tbl, cols in indexes:
        if not _index_exists(conn, idx_name):
            op.create_index(idx_name, tbl, cols)


def downgrade() -> None:
    op.drop_table("audit_logs")
