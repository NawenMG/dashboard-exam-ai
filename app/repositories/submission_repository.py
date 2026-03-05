from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.submission import Submission
from app.models.answer import Answer
from app.models.exam import Exam
from app.models.user import User

PAGE_SIZE_DEFAULT = 5
PAGE_SIZE_MAX = 50


class SubmissionRepository:
    # Crea una submission e salva anche tutte le answer (POST)
    @staticmethod
    async def create_with_answers(
        db: AsyncSession,
        *,
        submission: Submission,
        answers: list[Answer],
    ) -> Submission:
        db.add(submission)
        await db.flush()

        for a in answers:
            a.submission_id = submission.id
            db.add(a)

        await db.flush()
        return submission

    # Trova una precisa submission (GET: id)
    @staticmethod
    async def get_by_id(db: AsyncSession, submission_id: int) -> Submission | None:
        stmt = (
            select(Submission)
            .where(Submission.id == submission_id)
            .options(
                selectinload(Submission.answers),
                selectinload(Submission.student),
            )
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # Ritorna la lista di submission per materia del teacher for exam (GET: specific)
    @staticmethod
    async def list_by_subject(
        db: AsyncSession,
        *,
        subject: str,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Submission], int]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        count_stmt = (
            select(func.count(Submission.id))
            .select_from(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .join(User, User.id == Exam.teacher_id)
            .where(User.subject == subject)
        )
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .join(User, User.id == Exam.teacher_id)
            .where(User.subject == subject)
            .options(
                selectinload(Submission.answers),
                selectinload(Submission.student),
            )
            .order_by(desc(Submission.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # La lista delle submission per student id (GET: specific)
    @staticmethod
    async def list_by_student_id(
        db: AsyncSession,
        *,
        student_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Submission], int]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        count_stmt = select(func.count(Submission.id)).where(
            Submission.student_id == student_id
        )
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Submission)
            .where(Submission.student_id == student_id)
            .options(
                selectinload(Submission.answers),
                selectinload(Submission.student),
            )
            .order_by(desc(Submission.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # Permette al teacher di far vedere le submission di uno studente per i suoi esami (GET: specific)
    @staticmethod
    async def list_by_student_id_for_teacher(
        db: AsyncSession,
        *,
        student_id: int,
        teacher_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Submission], int]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        count_stmt = (
            select(func.count(Submission.id))
            .select_from(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .where(Submission.student_id == student_id)
            .where(Exam.teacher_id == teacher_id)
        )
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .where(Submission.student_id == student_id)
            .where(Exam.teacher_id == teacher_id)
            .options(
                selectinload(Submission.answers),
                selectinload(Submission.student),
            )
            .order_by(desc(Submission.created_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)

    # Lista delle submission di un esame solo se l'esame appartiene a quel teacher (GET: specific)
    @staticmethod
    async def list_by_exam_id_for_teacher(
        db: AsyncSession,
        *,
        exam_id: int,
        teacher_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> tuple[list[Submission], int]:
        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        offset = (page - 1) * page_size

        # filtra per exam + owner
        count_stmt = (
            select(func.count(Submission.id))
            .select_from(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .where(Submission.exam_id == exam_id)
            .where(Exam.teacher_id == teacher_id)
        )
        total = (await db.execute(count_stmt)).scalar_one()

        data_stmt = (
            select(Submission)
            .join(Exam, Exam.id == Submission.exam_id)
            .where(Submission.exam_id == exam_id)
            .where(Exam.teacher_id == teacher_id)
            .options(
                selectinload(Submission.answers),
                selectinload(Submission.student),
            )
            .order_by(desc(Submission.updated_at))
            .offset(offset)
            .limit(page_size)
        )
        items = (await db.execute(data_stmt)).scalars().all()

        return items, int(total)
