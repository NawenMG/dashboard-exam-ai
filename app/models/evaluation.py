import enum
from datetime import datetime
from typing import Any

from sqlalchemy import (
    ForeignKey,
    DateTime,
    Boolean,
    Integer,
    Text,
    UniqueConstraint,
    String,
    CheckConstraint,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EvaluatorType(str, enum.Enum):
    student = "student"
    peer = "peer"
    ai = "ai"

    @classmethod
    def values(cls) -> tuple[str, ...]:
        return tuple(v.value for v in cls)


class EvaluationStatus(str, enum.Enum):
    assigned = "assigned"  # stub/assegnata (solo per peer)
    completed = "completed"  # valutazione completa


class Evaluation(Base):
    __tablename__ = "evaluations"

    __table_args__ = (
        # ✅ multi-peer: una submission può avere più peer eval (una per studente)
        UniqueConstraint(
            "submission_id",
            "evaluator_type",
            "evaluator_id",
            name="uq_eval_submission_type_evaluator",
        ),
        CheckConstraint(
            f"evaluator_type IN {EvaluatorType.values()}",
            name="ck_evaluations_evaluator_type_valid",
        ),
        CheckConstraint(
            "status IN ('assigned','completed')",
            name="ck_evaluations_status_valid",
        ),
        # lookup veloce per queue peer
        Index("ix_eval_peer_queue", "evaluator_type", "evaluator_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    evaluator_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # ✅ chi ha fatto la valutazione (studente peer o owner per student)
    evaluator_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE", onupdate="RESTRICT"),
        index=True,
        nullable=True,  # per AI puoi lasciarlo NULL
    )

    # ✅ stato: peer assignment uses "assigned" stubs
    status: Mapped[str] = mapped_column(
        String(20),
        default=EvaluationStatus.completed.value,  # student/ai nascono completed
        nullable=False,
    )

    # ✅ per gli stub peer devono poter essere NULL
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    honors: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)

    details_json: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    assigned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    submission: Mapped["Submission"] = relationship(back_populates="evaluations")

    def set_evaluator_type(self, t: EvaluatorType) -> None:
        self.evaluator_type = t.value
