from datetime import datetime

from sqlalchemy import ForeignKey, DateTime, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Rappresenta una risposta di uno studente ad una specifica domanda di una submission
class Answer(Base):
    __tablename__ = "answers"
    __table_args__ = (
        UniqueConstraint(  # Uno studente può avere una singola risposta per domanda
            "submission_id", "question_index", name="uq_answers_submission_qidx"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    submission_id: Mapped[int] = (
        mapped_column(  # Questa risposta appartiene ad una submission
            ForeignKey("submissions.id", ondelete="RESTRICT", onupdate="RESTRICT"),
            index=True,
            nullable=False,
        )
    )

    question_index: Mapped[int] = mapped_column(nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    submission: Mapped["Submission"] = relationship(back_populates="answers")
