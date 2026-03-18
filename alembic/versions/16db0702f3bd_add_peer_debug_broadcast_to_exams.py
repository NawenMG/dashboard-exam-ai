"""add peer_debug_broadcast to exams"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "16db0702f3bd"
down_revision: Union[str, Sequence[str], None] = "b81c73ca9f41"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "exams",
        sa.Column(
            "peer_debug_broadcast",
            sa.Boolean(),
            nullable=True,
            server_default=sa.text("false"),
        ),
    )

    op.execute(
        "UPDATE exams SET peer_debug_broadcast = false WHERE peer_debug_broadcast IS NULL"
    )

    op.alter_column(
        "exams",
        "peer_debug_broadcast",
        existing_type=sa.Boolean(),
        nullable=False,
        server_default=sa.text("false"),
    )


def downgrade() -> None:
    op.drop_column("exams", "peer_debug_broadcast")
