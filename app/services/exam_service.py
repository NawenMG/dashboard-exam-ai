# app/services/exam_service.py
import math
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.exam import Exam
from app.models.user import User
from app.repositories.exam_repository import (
    ExamRepository,
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
)
from app.schemas.exam import ExamCreate, ExamUpdate, PagedExams, PageMeta, ExamOut


def _exam_to_out(exam: Exam) -> ExamOut:
    questions = exam.questions_json or {}
    rubric = exam.rubric_json or {}
    openai_schema = exam.openai_schema_json

    materials = exam.materials_json
    if not isinstance(materials, list):
        materials = []

    return ExamOut(
        id=exam.id,
        teacher_id=exam.teacher_id,
        title=exam.title,
        description=exam.description,
        questions_json=questions if isinstance(questions, dict) else {"questions": []},
        rubric_json=rubric if isinstance(rubric, dict) else {"criteria": []},
        openai_schema_json=openai_schema,
        materials_json=materials,
        is_published=bool(exam.is_published),
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )


class ExamService:
    @staticmethod
    async def create_draft(db: AsyncSession, *, teacher: User) -> ExamOut:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can create drafts."
            )

        # ✅ bozza minima ma valida (non null)
        exam = Exam(
            teacher_id=teacher.id,
            title="Bozza (non pubblicata)",
            description=None,
            questions_json={"questions": []},
            rubric_json={"criteria": []},
            openai_schema_json=None,
            materials_json=[],  # ✅ IMPORTANTISSIMO
            is_published=False,
        )

        await ExamRepository.create(db, exam)
        await db.commit()
        await db.refresh(exam)
        return _exam_to_out(exam)

    @staticmethod
    async def create_exam(
        db: AsyncSession, *, teacher: User, payload: ExamCreate
    ) -> ExamOut:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can create exams."
            )

        exam = Exam(
            teacher_id=teacher.id,
            title=payload.title,
            description=payload.description,
            questions_json=payload.questions_json,
            rubric_json=payload.rubric_json,
            openai_schema_json=payload.openai_schema_json,
            materials_json=[],  # ✅ invece di None: così FE/route materiali sempre ok
            is_published=payload.is_published,
        )

        await ExamRepository.create(db, exam)
        await db.commit()
        await db.refresh(exam)
        return _exam_to_out(exam)

    @staticmethod
    async def list_exams_by_subject(
        db: AsyncSession,
        *,
        subject: str,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
        teacher_id: int | None = None,
    ) -> PagedExams:
        items, total = await ExamRepository.list_by_subject(
            db, subject=subject, page=page, page_size=page_size, teacher_id=teacher_id
        )

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedExams(
            items=[_exam_to_out(x) for x in items],
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )

    @staticmethod
    async def list_my_exams(
        db: AsyncSession,
        *,
        teacher: User,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedExams:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can list their exams."
            )

        items, total = await ExamRepository.list_by_teacher(
            db, teacher_id=teacher.id, page=page, page_size=page_size
        )

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedExams(
            items=[_exam_to_out(x) for x in items],
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )

    @staticmethod
    async def list_published_exams(
        db: AsyncSession,
        *,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedExams:
        items, total = await ExamRepository.list_published(
            db, page=page, page_size=page_size
        )

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedExams(
            items=[_exam_to_out(x) for x in items],
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )

    @staticmethod
    async def update_exam(
        db: AsyncSession,
        *,
        teacher: User,
        exam_id: int,
        payload: ExamUpdate,
    ) -> ExamOut:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can update exams."
            )

        exam = await ExamRepository.get_by_id(db, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")
        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can only update your own exams."
            )

        data = payload.model_dump(exclude_unset=True)

        # ✅ NON aggiornare materials da qui
        data.pop("materials_json", None)

        ExamRepository.update_fields(exam, data)

        await db.commit()
        await db.refresh(exam)
        return _exam_to_out(exam)

    @staticmethod
    async def delete_exam(db: AsyncSession, *, teacher: User, exam_id: int) -> None:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can delete exams."
            )

        exam = await ExamRepository.get_by_id(db, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")
        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can only delete your own exams."
            )

        await ExamRepository.delete(db, exam)
        await db.commit()
