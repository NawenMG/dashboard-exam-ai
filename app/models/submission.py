from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import ForeignKey, DateTime, String, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SubmissionStatus(str, Enum):
    in_progress = "in_progress"
    submitted = "submitted"
    ai_done = "ai_done"
    teacher_done = "teacher_done"
    finalized = "finalized"

    @classmethod
    def values(cls) -> tuple[str, ...]:
        return tuple(s.value for s in cls)


class Submission(Base):
    __tablename__ = "submissions"

    __table_args__ = (
        UniqueConstraint("exam_id", "student_id", name="uq_submissions_exam_student"),
        CheckConstraint(
            f"status IN {SubmissionStatus.values()}",
            name="ck_submissions_status_valid",
        ),
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

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default=SubmissionStatus.in_progress.value,
    )

    submitted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ✅ NEW: quando il teacher “chiude” la peer review
    peer_reviews_closed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
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

    # helpers
    def set_status(self, status: SubmissionStatus) -> None:
        self.status = status.value
