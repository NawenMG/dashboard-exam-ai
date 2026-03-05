"""extend evaluations for peer assignments

Revision ID: XXXXXXXXXXXX
Revises: <PUT_PREVIOUS_REVISION_HERE>
Create Date: 2026-02-22

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8ce805383295"
down_revision = "6d518f11a29a"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------
    # 0) data migration safety: teacher -> peer (se mai esistesse)
    # ------------------------------------------------------------
    op.execute(
        "UPDATE evaluations SET evaluator_type='peer' WHERE evaluator_type='teacher'"
    )

    # ------------------------------------------------------------
    # 1) Drop old unique constraint (submission_id, evaluator_type)
    # ------------------------------------------------------------
    op.drop_constraint("uq_eval_submission_type", "evaluations", type_="unique")

    # ------------------------------------------------------------
    # 2) Add new columns
    # ------------------------------------------------------------
    op.add_column("evaluations", sa.Column("evaluator_id", sa.Integer(), nullable=True))
    op.add_column(
        "evaluations",
        sa.Column(
            "status", sa.String(length=20), server_default="completed", nullable=False
        ),
    )
    op.add_column("evaluations", sa.Column("assigned_at", sa.DateTime(), nullable=True))
    op.add_column(
        "evaluations", sa.Column("completed_at", sa.DateTime(), nullable=True)
    )

    # FK evaluator_id -> users.id
    op.create_foreign_key(
        "fk_evaluations_evaluator_id_users",
        "evaluations",
        "users",
        ["evaluator_id"],
        ["id"],
        ondelete="CASCADE",
        onupdate="RESTRICT",
    )

    # Index su evaluator_id
    op.create_index("ix_evaluations_evaluator_id", "evaluations", ["evaluator_id"])

    # ------------------------------------------------------------
    # 3) Make score/comment nullable (stubs 'assigned')
    # ------------------------------------------------------------
    op.alter_column("evaluations", "score", existing_type=sa.Integer(), nullable=True)
    op.alter_column("evaluations", "comment", existing_type=sa.Text(), nullable=True)

    # ------------------------------------------------------------
    # 4) Backfill evaluator_id for existing rows (best-effort)
    # ------------------------------------------------------------
    # - student eval: evaluator_id = submissions.student_id
    # - ai eval: evaluator_id = NULL
    # - peer eval (ex teacher): NON sappiamo chi l'ha fatta storicamente -> NULL
    #
    # Se vuoi, puoi fare una regola diversa.
    op.execute(
        """
        UPDATE evaluations e
        SET evaluator_id = s.student_id
        FROM submissions s
        WHERE e.submission_id = s.id
          AND e.evaluator_type = 'student'
          AND e.evaluator_id IS NULL
        """
    )

    op.execute(
        """
        UPDATE evaluations
        SET evaluator_id = NULL
        WHERE evaluator_type = 'ai'
        """
    )

    # status: tutte le evaluation esistenti diventano completed
    op.execute(
        """
        UPDATE evaluations
        SET status = 'completed'
        WHERE status IS NULL OR status NOT IN ('assigned','completed')
        """
    )

    # completed_at: se NULL, metti created_at (comodo per sorting)
    op.execute(
        """
        UPDATE evaluations
        SET completed_at = created_at
        WHERE status = 'completed' AND completed_at IS NULL
        """
    )

    # ------------------------------------------------------------
    # 5) Drop & recreate evaluator_type check constraint (se necessario)
    # ------------------------------------------------------------
    # (Alembic non aggiorna i CHECK automaticamente, quindi lo rifacciamo)
    op.drop_constraint(
        "ck_evaluations_evaluator_type_valid", "evaluations", type_="check"
    )
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','peer','ai')",
    )

    # ------------------------------------------------------------
    # 6) Add status check constraint
    # ------------------------------------------------------------
    op.create_check_constraint(
        "ck_evaluations_status_valid",
        "evaluations",
        "status IN ('assigned','completed')",
    )

    # ------------------------------------------------------------
    # 7) Create new unique constraint (submission_id, evaluator_type, evaluator_id)
    # ------------------------------------------------------------
    op.create_unique_constraint(
        "uq_eval_submission_type_evaluator",
        "evaluations",
        ["submission_id", "evaluator_type", "evaluator_id"],
    )

    # ------------------------------------------------------------
    # 8) Create peer queue index: (evaluator_type, evaluator_id, status)
    # ------------------------------------------------------------
    op.create_index(
        "ix_eval_peer_queue",
        "evaluations",
        ["evaluator_type", "evaluator_id", "status"],
    )

    # ------------------------------------------------------------
    # 9) Remove server_default from status (optional: keep it if you want)
    # ------------------------------------------------------------
    op.alter_column("evaluations", "status", server_default=None)


def downgrade() -> None:
    # ------------------------------------------------------------
    # 1) Drop peer queue index and new unique
    # ------------------------------------------------------------
    op.drop_index("ix_eval_peer_queue", table_name="evaluations")
    op.drop_constraint(
        "uq_eval_submission_type_evaluator", "evaluations", type_="unique"
    )

    # ------------------------------------------------------------
    # 2) Drop status check constraint
    # ------------------------------------------------------------
    op.drop_constraint("ck_evaluations_status_valid", "evaluations", type_="check")

    # ------------------------------------------------------------
    # 3) Recreate old evaluator_type check (teacher reintroduced on downgrade)
    # ------------------------------------------------------------
    op.drop_constraint(
        "ck_evaluations_evaluator_type_valid", "evaluations", type_="check"
    )
    op.create_check_constraint(
        "ck_evaluations_evaluator_type_valid",
        "evaluations",
        "evaluator_type IN ('student','teacher','ai')",
    )

    # data migration peer -> teacher on downgrade
    op.execute(
        "UPDATE evaluations SET evaluator_type='teacher' WHERE evaluator_type='peer'"
    )

    # ------------------------------------------------------------
    # 4) Make score/comment NOT NULL again (WARNING: fails if you have stubs)
    # ------------------------------------------------------------
    # Se nel frattempo hai creato stubs assigned con score/comment null,
    # prima di fare downgrade devi pulirli o valorizzarli.
    op.alter_column("evaluations", "comment", existing_type=sa.Text(), nullable=False)
    op.alter_column("evaluations", "score", existing_type=sa.Integer(), nullable=False)

    # ------------------------------------------------------------
    # 5) Drop FK + index + new columns
    # ------------------------------------------------------------
    op.drop_index("ix_evaluations_evaluator_id", table_name="evaluations")
    op.drop_constraint(
        "fk_evaluations_evaluator_id_users", "evaluations", type_="foreignkey"
    )

    op.drop_column("evaluations", "completed_at")
    op.drop_column("evaluations", "assigned_at")
    op.drop_column("evaluations", "status")
    op.drop_column("evaluations", "evaluator_id")

    # ------------------------------------------------------------
    # 6) Restore old unique constraint (submission_id, evaluator_type)
    # ------------------------------------------------------------
    op.create_unique_constraint(
        "uq_eval_submission_type",
        "evaluations",
        ["submission_id", "evaluator_type"],
    )
