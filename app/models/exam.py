from datetime import datetime

from sqlalchemy import (
    String,
    ForeignKey,
    DateTime,
    Boolean,
    CheckConstraint,
)
from sqlalchemy.dialects.mysql import LONGTEXT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


# Rappresenta l'esame creato da un docente, con dentro domande + rubrica json e collegamenti alle submission
class Exam(Base):
    __tablename__ = "exams"

    __table_args__ = (
        CheckConstraint(
            "json_valid(questions_json)", name="ck_exams_questions_json_valid"
        ),
        CheckConstraint("json_valid(rubric_json)", name="ck_exams_rubric_json_valid"),
        CheckConstraint(
            "json_valid(openai_schema_json)", name="ck_exams_openai_schema_json_valid"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    teacher_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT", onupdate="RESTRICT"),
        index=True,
        nullable=False,
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    description: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)

    # LONGTEXT con CHECK json_valid(...)
    questions_json: Mapped[str] = mapped_column(LONGTEXT, nullable=False)
    rubric_json: Mapped[str] = mapped_column(LONGTEXT, nullable=False)
    openai_schema_json: Mapped[str | None] = mapped_column(LONGTEXT, nullable=True)

    is_published: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # ✅ valori gestiti dall'app (non dal DB)
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
    teacher: Mapped["User"] = relationship(back_populates="created_exams")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="exam")
