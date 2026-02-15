"""add revoked_tokens table

Revision ID: 88defc87006c
Revises: c64c11ad46c8
Create Date: 2026-02-11
"""

from alembic import op
import sqlalchemy as sa

revision = "88defc87006c"
down_revision = "c64c11ad46c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("revoked_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column(
            "is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")
        ),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
    )

    op.create_unique_constraint("uq_revoked_tokens_jti", "revoked_tokens", ["jti"])
    op.create_index("ix_revoked_tokens_user_id", "revoked_tokens", ["user_id"])
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])


def downgrade() -> None:
    op.drop_index("ix_revoked_tokens_expires_at", table_name="revoked_tokens")
    op.drop_index("ix_revoked_tokens_user_id", table_name="revoked_tokens")
    op.drop_constraint("uq_revoked_tokens_jti", "revoked_tokens", type_="unique")
    op.drop_table("revoked_tokens")
