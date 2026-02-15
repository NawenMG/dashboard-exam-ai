from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session

from app.models.exam import Exam
from app.models.user import User

PAGE_SIZE_DEFAULT = 5
PAGE_SIZE_MAX = 200


class ExamRepository:
    # Per creare un esame (POST)
    @staticmethod
    def create(db: Session, exam: Exam) -> Exam:
        db.add(exam)
        db.flush()
        return exam

    # Trova un esame per id (GET: id)
    @staticmethod
    def get_by_id(db: Session, exam_id: int) -> Exam | None:
        stmt = select(Exam).where(Exam.id == exam_id)
        return db.execute(stmt).scalar_one_or_none()

    # Lista degli esami per materia (GET: subject)
    @staticmethod
    def list_by_subject(
        db: Session,
        *,
        subject: str,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
        teacher_id: int | None = None,
    ) -> tuple[list[Exam], int]:
        """
        (items, total) degli esami filtrati per materia = users.subject del teacher.
        Se teacher_id è valorizzato, ritorna SOLO gli esami di quel teacher.
        Ordinati per created_at DESC.
        """
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        base_where = [User.subject == subject]
        if teacher_id is not None:
            base_where.append(Exam.teacher_id == teacher_id)

        count_stmt = (
            select(func.count(Exam.id))
            .select_from(Exam)
            .join(User, User.id == Exam.teacher_id)
            .where(*base_where)
        )
        total = db.execute(count_stmt).scalar_one()

        data_stmt = (
            select(Exam)
            .join(User, User.id == Exam.teacher_id)
            .where(*base_where)
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = db.execute(data_stmt).scalars().all()

        return items, int(total)

    # Lista degli esami per uno specifico teacher (GET: Teacher)
    @staticmethod
    def list_by_teacher(
        db: Session,
        *,
        teacher_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Exam], int]:
        """
        (items, total) degli esami di un teacher.
        Ordinati per created_at DESC.
        """
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        count_stmt = select(func.count(Exam.id)).where(Exam.teacher_id == teacher_id)
        total = db.execute(count_stmt).scalar_one()

        data_stmt = (
            select(Exam)
            .where(Exam.teacher_id == teacher_id)
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = db.execute(data_stmt).scalars().all()

        return items, int(total)

    # Lista degli esami pubblicati (GET: bool)
    @staticmethod
    def list_published(
        db: Session,
        *,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Exam], int]:
        """
        (items, total) di TUTTI gli esami pubblicati.
        Ordinati per created_at DESC.
        """
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        count_stmt = select(func.count(Exam.id)).where(Exam.is_published == True)
        total = db.execute(count_stmt).scalar_one()

        data_stmt = (
            select(Exam)
            .where(Exam.is_published == True)
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = db.execute(data_stmt).scalars().all()

        return items, int(total)

    # Aggiorna gli attributi di un esame (PUT)
    @staticmethod
    def update_fields(exam: Exam, data: dict) -> Exam:
        for field, value in data.items():
            setattr(exam, field, value)
        return exam

    # Per eliminare un specifico esame (DELETE)
    @staticmethod
    def delete(db: Session, exam: Exam) -> None:
        db.delete(exam)
