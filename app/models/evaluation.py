import enum
from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    DateTime,
    Enum,
    Boolean,
    Integer,
    Text,
    JSON,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Rappresenta la valutazione di una submission, fatta da uno specifico tipo di valutatore (ai, self e teacher)
class EvaluatorType(str, enum.Enum):
    student = "student"
    teacher = "teacher"
    ai = "ai"


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint(
            "submission_id", "evaluator_type", name="uq_eval_submission_type"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id"),
        index=True,
        nullable=False,
    )

    evaluator_type: Mapped[EvaluatorType] = mapped_column(
        Enum(EvaluatorType),
        nullable=False,
    )

    score: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    honors: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    comment: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    details_json: Mapped[dict | None] = mapped_column(JSON)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    submission: Mapped["Submission"] = relationship(
        back_populates="evaluations",
    )
