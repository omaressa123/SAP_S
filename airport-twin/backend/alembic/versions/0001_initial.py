"""Initial schema: twin_locations, twin_assets, twin_asset_state, twin_asset_events, robot_positions."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

JSON_COL = sa.JSON().with_variant(JSONB, "postgresql")


def upgrade() -> None:
    op.create_table(
        "twin_locations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(), nullable=False, unique=True),
        sa.Column("floor", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("zone_type", sa.String(), nullable=False),
    )
    op.create_table(
        "twin_assets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("asset_code", sa.String(), nullable=False, unique=True),
        sa.Column("asset_type", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("model_key", sa.String(), nullable=False),
        sa.Column("location_id", sa.String(36), sa.ForeignKey("twin_locations.id"), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
    )
    op.create_table(
        "twin_asset_state",
        sa.Column("asset_id", sa.String(36), sa.ForeignKey("twin_assets.id"), primary_key=True),
        sa.Column("status", sa.String(), nullable=False, server_default="unknown"),
        sa.Column("health_score", sa.Float(), nullable=True),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "twin_asset_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("asset_id", sa.String(36), sa.ForeignKey("twin_assets.id"), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("payload", JSON_COL, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "robot_positions",
        sa.Column("asset_code", sa.String(), primary_key=True),
        sa.Column("x", sa.Float(), nullable=False, server_default="0"),
        sa.Column("y", sa.Float(), nullable=False, server_default="0"),
        sa.Column("z", sa.Float(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    for table in ("robot_positions", "twin_asset_events", "twin_asset_state",
                  "twin_assets", "twin_locations"):
        op.drop_table(table)
