"""FIX-1: Persistent management tables — replaces in-memory stores.

Adds (with IF NOT EXISTS guards so create_all pre-runs are harmless):
  inventory_items         (was _inventory_store list)
  sops                    (was _sop_store list)
  integration_connections (was _connected_store dict)
  widget_layouts          (was _widget_store dict)
  grow_journal_entries    (was _journal_store list)

IF NOT EXISTS is used on every CREATE TABLE so that if SQLAlchemy's
create_all() ran before Alembic (which this project does in entrypoint),
the migration is idempotent and does NOT raise DuplicateTableError.

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-09 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0005'
down_revision = '0004'
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    """Check if a table already exists in PostgreSQL."""
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema = 'public' AND table_name = :t)"
    ), {"t": table_name})
    return result.scalar()


def _index_exists(conn, index_name: str) -> bool:
    """Check if an index already exists in PostgreSQL."""
    result = conn.execute(text(
        "SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = :i)"
    ), {"i": index_name})
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # ── inventory_items ──────────────────────────────────────────────────────
    if not _table_exists(conn, "inventory_items"):
        op.create_table(
            "inventory_items",
            sa.Column("id",              sa.String,  primary_key=True),
            sa.Column("organization_id", sa.String,  sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("name",            sa.String(200), nullable=False),
            sa.Column("category",        sa.String(100), server_default="Nutrients"),
            sa.Column("unit",            sa.String(30),  server_default="kg"),
            sa.Column("quantity",        sa.Float,  server_default="0"),
            sa.Column("min_stock",       sa.Float,  server_default="0"),
            sa.Column("reorder_qty",     sa.Float,  server_default="0"),
            sa.Column("cost_per_unit",   sa.Float,  server_default="0"),
            sa.Column("supplier",        sa.String(200), nullable=True),
            sa.Column("sku",             sa.String(100), nullable=True),
            sa.Column("location",        sa.String(200), nullable=True),
            sa.Column("notes",           sa.Text,   nullable=True),
            sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    if not _index_exists(conn, "ix_inventory_org_category"):
        op.create_index("ix_inventory_org_category", "inventory_items",
                        ["organization_id", "category"])

    # ── sops ─────────────────────────────────────────────────────────────────
    if not _table_exists(conn, "sops"):
        op.create_table(
            "sops",
            sa.Column("id",              sa.String, primary_key=True),
            sa.Column("organization_id", sa.String, sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("title",           sa.String(300), nullable=False),
            sa.Column("category",        sa.String(100), server_default="Operations"),
            sa.Column("frequency",       sa.String(100), server_default="As needed"),
            sa.Column("department",      sa.String(100), server_default="Operations"),
            sa.Column("version",         sa.String(20),  server_default="1.0"),
            sa.Column("status",          sa.String(20),  server_default="active"),
            sa.Column("steps",           sa.JSON,   nullable=True),
            sa.Column("tags",            sa.JSON,   nullable=True),
            sa.Column("created_by_id",   sa.String, sa.ForeignKey("users.id"), nullable=True),
            sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    if not _index_exists(conn, "ix_sop_org_category"):
        op.create_index("ix_sop_org_category", "sops", ["organization_id", "category"])

    # ── integration_connections ───────────────────────────────────────────────
    if not _table_exists(conn, "integration_connections"):
        op.create_table(
            "integration_connections",
            sa.Column("id",               sa.String, primary_key=True),
            sa.Column("organization_id",  sa.String, sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("integration_id",   sa.String(80),  nullable=False),
            sa.Column("integration_name", sa.String(200), nullable=False),
            sa.Column("status",           sa.String(30),  server_default="healthy"),
            sa.Column("config",           sa.JSON,   nullable=True),
            sa.Column("credentials_json", sa.Text,   nullable=True),
            sa.Column("events_today",     sa.Integer, server_default="0"),
            sa.Column("last_synced_at",   sa.DateTime(timezone=True), nullable=True),
            sa.Column("last_error",       sa.Text,   nullable=True),
            sa.Column("connected_at",     sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",       sa.DateTime(timezone=True), onupdate=sa.func.now()),
            sa.UniqueConstraint("organization_id", "integration_id",
                                name="uq_integration_conn_org_integ"),
        )
    if not _index_exists(conn, "ix_integration_conn_org"):
        op.create_index("ix_integration_conn_org", "integration_connections",
                        ["organization_id"])

    # ── widget_layouts ────────────────────────────────────────────────────────
    if not _table_exists(conn, "widget_layouts"):
        op.create_table(
            "widget_layouts",
            sa.Column("id",              sa.String, primary_key=True),
            sa.Column("user_id",         sa.String, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("organization_id", sa.String, sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("widget_type",     sa.String(80),  nullable=False),
            sa.Column("title",           sa.String(100), nullable=True),
            sa.Column("config",          sa.JSON,   nullable=True),
            sa.Column("position_x",      sa.Integer, server_default="0"),
            sa.Column("position_y",      sa.Integer, server_default="0"),
            sa.Column("width",           sa.Integer, server_default="2"),
            sa.Column("height",          sa.Integer, server_default="2"),
            sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    if not _index_exists(conn, "ix_widget_layouts_user"):
        op.create_index("ix_widget_layouts_user", "widget_layouts", ["user_id"])

    # ── grow_journal_entries ──────────────────────────────────────────────────
    if not _table_exists(conn, "grow_journal_entries"):
        op.create_table(
            "grow_journal_entries",
            sa.Column("id",              sa.String, primary_key=True),
            sa.Column("organization_id", sa.String, sa.ForeignKey("organizations.id"), nullable=False),
            sa.Column("author_id",       sa.String, sa.ForeignKey("users.id"), nullable=False),
            sa.Column("type",            sa.String(50),  server_default="observation"),
            sa.Column("title",           sa.String(300), nullable=False),
            sa.Column("body",            sa.Text,   server_default=""),
            sa.Column("batch_code",      sa.String(50),  nullable=True),
            sa.Column("zone_id",         sa.String, sa.ForeignKey("zones.id"), nullable=True),
            sa.Column("tags",            sa.JSON,   nullable=True),
            sa.Column("severity",        sa.String(20),  server_default="info"),
            sa.Column("sensors",         sa.JSON,   nullable=True),
            sa.Column("created_at",      sa.DateTime(timezone=True), server_default=sa.func.now()),
            sa.Column("updated_at",      sa.DateTime(timezone=True), onupdate=sa.func.now()),
        )
    if not _index_exists(conn, "ix_journal_org_created"):
        op.create_index("ix_journal_org_created", "grow_journal_entries",
                        ["organization_id", "created_at"])
    if not _index_exists(conn, "ix_journal_batch_code"):
        op.create_index("ix_journal_batch_code", "grow_journal_entries", ["batch_code"])


def downgrade() -> None:
    conn = op.get_bind()
    for table in ["grow_journal_entries", "widget_layouts",
                  "integration_connections", "sops", "inventory_items"]:
        if _table_exists(conn, table):
            op.drop_table(table)
