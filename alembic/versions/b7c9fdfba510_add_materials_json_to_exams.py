"""add materials_json to exams

Revision ID: b7c9fdfba510
Revises: b000672a218f
Create Date: 2026-02-19 15:28:19.051170

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "b7c9fdfba510"
down_revision: Union[str, Sequence[str], None] = "b000672a218f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ✅ aggiunge la colonna JSONB (NULL di default, come vuoi tu)
    op.add_column(
        "exams",
        sa.Column(
            "materials_json",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
    )

    # (opzionale) se vuoi default DB = '[]' invece che NULL:
    # op.execute("UPDATE exams SET materials_json = '[]'::jsonb WHERE materials_json IS NULL")
    # op.alter_column("exams", "materials_json", nullable=False, server_default=sa.text("'[]'::jsonb"))


def downgrade() -> None:
    op.drop_column("exams", "materials_json")
