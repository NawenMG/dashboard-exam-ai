import enum
from datetime import datetime

from sqlalchemy import String, Enum, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"


# L'utente può essere di tipo teacher o student
class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )

    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole),
        nullable=False,
    )

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    matricola: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(String(255))
    age: Mapped[int | None]

    subject: Mapped[str | None] = mapped_column(
        String(255),
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
    created_exams: Mapped[list["Exam"]] = relationship(
        back_populates="teacher",
        foreign_keys="Exam.teacher_id",
    )

    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="student",
        foreign_keys="Submission.student_id",
    )
