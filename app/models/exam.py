from datetime import datetime
from typing import Any

from sqlalchemy import String, ForeignKey, DateTime, Boolean, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Exam(Base):
    __tablename__ = "exams"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    questions_json: Mapped[Any] = mapped_column(JSONB, nullable=False)
    rubric_json: Mapped[Any] = mapped_column(JSONB, nullable=False)
    openai_schema_json: Mapped[Any | None] = mapped_column(JSONB, nullable=True)

    materials_json: Mapped[Any | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    is_published: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # ✅ backdoor applicativa per peer review debug
    # Se true, tutte le submission di questo esame vengono mostrate
    # a student1 e student3 nella peer queue, bypassando il limite 5.
    peer_debug_broadcast: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
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

    teacher: Mapped["User"] = relationship(back_populates="created_exams")

    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="exam",
    )
