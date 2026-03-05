"""add peer_reviews_closed_at to submissions

Revision ID: b81c73ca9f41
Revises: dc05de1fc695
Create Date: 2026-02-25 14:56:20.420959

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b81c73ca9f41"
down_revision: Union[str, Sequence[str], None] = "dc05de1fc695"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "submissions",
        sa.Column("peer_reviews_closed_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_submissions_peer_reviews_closed_at",
        "submissions",
        ["peer_reviews_closed_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_submissions_peer_reviews_closed_at", table_name="submissions")
    op.drop_column("submissions", "peer_reviews_closed_at")
