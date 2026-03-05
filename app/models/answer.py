from datetime import datetime

from sqlalchemy import ForeignKey, DateTime, Text, UniqueConstraint, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Answer(Base):
    __tablename__ = "answers"

    __table_args__ = (
        UniqueConstraint(
            "submission_id",
            "question_index",
            name="uq_answers_submission_qidx",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="RESTRICT", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    question_index: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    answer_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False,
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )

    submission: Mapped["Submission"] = relationship(back_populates="answers")
