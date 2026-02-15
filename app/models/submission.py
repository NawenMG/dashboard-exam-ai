from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import ForeignKey, DateTime, Enum as SAEnum, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Consegna dello svolgimento di un esame da parte di uno studente
class SubmissionStatus(str, Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    ai_done = "ai_done"
    teacher_done = "teacher_done"
    finalized = "finalized"


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_submissions_exam_student"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    exam_id: Mapped[int] = mapped_column(
        ForeignKey("exams.id", ondelete="RESTRICT", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    status: Mapped[SubmissionStatus] = mapped_column(
        SAEnum(SubmissionStatus, native_enum=False),
        default=SubmissionStatus.in_progress,
        nullable=False,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )

    # relationships
    exam: Mapped["Exam"] = relationship(back_populates="submissions")
    student: Mapped["User"] = relationship(back_populates="submissions")

    answers: Mapped[list["Answer"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
    )

    evaluations: Mapped[list["Evaluation"]] = relationship(
        back_populates="submission",
        cascade="all, delete-orphan",
    )

    final_grade: Mapped[Optional["FinalGrade"]] = relationship(
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
    )
