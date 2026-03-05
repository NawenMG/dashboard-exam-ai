from datetime import datetime
from decimal import Decimal

from sqlalchemy import ForeignKey, DateTime, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FinalGrade(Base):
    """
    Media pesata delle evaluation (peer, AI, student)
    """

    __tablename__ = "final_grades"

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        primary_key=True,
    )

    peer_weight: Mapped[Decimal] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        default=Decimal("0.60"),
    )

    ai_weight: Mapped[Decimal] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        default=Decimal("0.30"),
    )

    self_weight: Mapped[Decimal] = mapped_column(
        Numeric(4, 2),
        nullable=False,
        default=Decimal("0.10"),
    )

    final_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2),
        nullable=False,
    )

    final_honors: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    computed_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    submission: Mapped["Submission"] = relationship(
        back_populates="final_grade",
        lazy="joined",
    )
