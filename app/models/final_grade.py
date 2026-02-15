from datetime import datetime

from sqlalchemy import ForeignKey, DateTime, Boolean, DECIMAL
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Media delle evaluation
class FinalGrade(Base):
    __tablename__ = "final_grades"

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id"),
        primary_key=True,
    )

    teacher_weight: Mapped[float] = mapped_column(
        DECIMAL(4, 2),
        default=0.60,
    )

    ai_weight: Mapped[float] = mapped_column(
        DECIMAL(4, 2),
        default=0.30,
    )

    self_weight: Mapped[float] = mapped_column(
        DECIMAL(4, 2),
        default=0.10,
    )

    final_score: Mapped[float] = mapped_column(
        DECIMAL(5, 2),
        nullable=False,
    )

    final_honors: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
    )

    computed_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
    )

    submission: Mapped["Submission"] = relationship(
        back_populates="final_grade",
    )
