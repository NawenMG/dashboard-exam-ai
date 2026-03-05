"""rename teacher_weight to peer_weight in final_grades

Revision ID: dc05de1fc695
Revises: 8ce805383295
Create Date: 2026-02-22 09:32:32.610528

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa  # noqa: F401


# revision identifiers, used by Alembic.
revision: str = "dc05de1fc695"
down_revision: Union[str, Sequence[str], None] = "8ce805383295"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # rename column teacher_weight -> peer_weight
    op.alter_column("final_grades", "teacher_weight", new_column_name="peer_weight")


def downgrade() -> None:
    # rename column peer_weight -> teacher_weight
    op.alter_column("final_grades", "peer_weight", new_column_name="teacher_weight")
