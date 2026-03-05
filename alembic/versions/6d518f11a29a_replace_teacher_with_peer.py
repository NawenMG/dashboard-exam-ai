"""replace teacher with peer

Revision ID: 6d518f11a29a
Revises: b7c9fdfba510
Create Date: 2026-02-21 12:46:18.694423

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "6d518f11a29a"
down_revision: Union[str, Sequence[str], None] = "b7c9fdfba510"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) data migration: teacher -> peer (se hai già dati in DB)
    op.execute(
        "UPDATE evaluations SET evaluator_type='peer' WHERE evaluator_type='teacher'"
    )

    # 2) aggiorna il CHECK constraint
    op.drop_constraint(
        "ck_evaluations_evaluator_type_valid", "evaluations", type_="check"
    )
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','peer','ai')",
    )


def downgrade() -> None:
    # rollback dati: peer -> teacher
    op.execute(
        "UPDATE evaluations SET evaluator_type='teacher' WHERE evaluator_type='peer'"
    )

    # rollback CHECK constraint
    op.drop_constraint(
        "ck_evaluations_evaluator_type_valid", "evaluations", type_="check"
    )
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','teacher','ai')",
    )
