import enum
from datetime import datetime

from sqlalchemy import String, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    student = "student"
    teacher = "teacher"

    @classmethod
    def values(cls) -> tuple[str, ...]:
        return tuple(role.value for role in cls)


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            f"role IN {UserRole.values()}",
            name="ck_users_role_valid",
        ),
    )

    id: Mapped[int] = mapped_column(
        primary_key=True,
        autoincrement=True,
    )

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

    # ✅ VARCHAR invece di ENUM TYPE
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.student.value,
    )

    first_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    last_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )

    matricola: Mapped[str | None] = mapped_column(
        String(50),
        unique=True,
        nullable=True,
    )

    address: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    age: Mapped[int | None] = mapped_column(
        nullable=True,
    )

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
        cascade="all, delete-orphan",
    )

    submissions: Mapped[list["Submission"]] = relationship(
        back_populates="student",
        foreign_keys="Submission.student_id",
        cascade="all, delete-orphan",
    )

    # helper methods

    def is_teacher(self) -> bool:
        return self.role == UserRole.teacher.value

    def is_student(self) -> bool:
        return self.role == UserRole.student.value

    def set_role(self, role: UserRole) -> None:
        self.role = role.value
