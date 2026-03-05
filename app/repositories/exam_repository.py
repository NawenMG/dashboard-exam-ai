# app/repositories/exam_repository.py

from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import Exam
from app.models.user import User

PAGE_SIZE_DEFAULT = 5
PAGE_SIZE_MAX = 200


class ExamRepository:
    # Per creare un esame (POST)
    @staticmethod
    async def create(db: AsyncSession, exam: Exam) -> Exam:
        # ✅ garantisci che il JSONB non finisca NULL (se la colonna è NOT NULL)
        if getattr(exam, "materials_json", None) is None:
            exam.materials_json = []

        db.add(exam)
        await db.flush()
        return exam

    # Trova un esame per id (GET: id)
    @staticmethod
    async def get_by_id(db: AsyncSession, exam_id: int) -> Exam | None:
        stmt = select(Exam).where(Exam.id == exam_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # Lista degli esami per materia (GET: subject)
    @staticmethod
    async def list_by_subject(
        db: AsyncSession,
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
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Exam)
            .join(User, User.id == Exam.teacher_id)
            .where(*base_where)
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # Lista degli esami per uno specifico teacher (GET: Teacher)
    @staticmethod
    async def list_by_teacher(
        db: AsyncSession,
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
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Exam)
            .where(Exam.teacher_id == teacher_id)
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # Lista degli esami pubblicati (GET: bool)
    @staticmethod
    async def list_published(
        db: AsyncSession,
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

        count_stmt = select(func.count(Exam.id)).where(Exam.is_published.is_(True))
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Exam)
            .where(Exam.is_published.is_(True))
            .order_by(desc(Exam.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # Aggiorna gli attributi di un esame (PUT)
    @staticmethod
    def update_fields(exam: Exam, data: dict) -> Exam:
        # ✅ NON permettere update dei materiali via update generico
        # (si gestiscono solo dalle rotte /materials/*)
        data.pop("materials_json", None)

        for field, value in data.items():
            setattr(exam, field, value)
        return exam

    # Per eliminare un specifico esame (DELETE)
    @staticmethod
    async def delete(db: AsyncSession, exam: Exam) -> None:
        await db.delete(exam)
