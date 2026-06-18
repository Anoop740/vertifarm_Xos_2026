"""Add metadata_json to anomaly_logs; update anomaly_score comment.

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-11 01:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def _col_exists(conn, table: str, column: str) -> bool:
    result = conn.execute(text(
        "SELECT EXISTS ("
        "  SELECT 1 FROM information_schema.columns "
        "  WHERE table_schema = 'public' AND table_name = :t AND column_name = :c"
        ")"
    ), {"t": table, "c": column})
    return result.scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # Add metadata_json to anomaly_logs (stores z_score, iqr_fences, detection method)
    if not _col_exists(conn, "anomaly_logs", "metadata_json"):
        op.add_column(
            "anomaly_logs",
            sa.Column("metadata_json", sa.JSON, server_default=sa.text("'{}'::json"), nullable=True),
        )

    # Add recommendation column to cv_scans if missing (used by CV analyser output)
    if not _col_exists(conn, "cv_scans", "recommendation"):
        op.add_column(
            "cv_scans",
            sa.Column("recommendation", sa.Text, nullable=True),
        )

    # Add crop_name, plant_count, growth_stage to cv_scans if missing
    for col_name, col_type in [
        ("crop_name", sa.String(100)),
        ("plant_count", sa.Integer),
        ("growth_stage", sa.String(100)),
    ]:
        if not _col_exists(conn, "cv_scans", col_name):
            op.add_column("cv_scans", sa.Column(col_name, col_type, nullable=True))


def downgrade() -> None:
    op.drop_column("anomaly_logs", "metadata_json")
    for col in ["recommendation", "crop_name", "plant_count", "growth_stage"]:
        op.drop_column("cv_scans", col)
