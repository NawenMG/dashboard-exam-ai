import math
import json
from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from sqlalchemy import select

from app.models.user import User, UserRole
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionStatus
from app.models.answer import Answer
from app.repositories.submission_repository import (
    SubmissionRepository,
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
)
from app.schemas.submission import SubmissionCreate, PagedSubmissions, PageMeta


def _extract_questions_count(exam: Exam) -> int | None:
    try:
        if isinstance(exam.questions_json, (dict, list)):
            data = exam.questions_json
        else:
            data = json.loads(exam.questions_json)
    except Exception:
        return None

    if isinstance(data, dict) and isinstance(data.get("questions"), list):
        return len(data["questions"])
    if isinstance(data, list):
        return len(data)
    return None


class SubmissionService:
    @staticmethod
    async def create_submission(
        db: AsyncSession, *, student: User, payload: SubmissionCreate
    ) -> Submission:
        if student.role != "student":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only students can create submissions.",
            )

        result = await db.execute(select(Exam).where(Exam.id == payload.exam_id))
        exam = result.scalars().first()

        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")

        if not payload.answers:
            raise HTTPException(status_code=400, detail="Answers list cannot be empty.")

        idxs = [a.question_index for a in payload.answers]
        if len(set(idxs)) != len(idxs):
            raise HTTPException(
                status_code=400, detail="Duplicate question_index in answers payload."
            )

        qcount = _extract_questions_count(exam)
        if qcount is not None:
            bad = [i for i in idxs if i < 0 or i >= qcount]
            if bad:
                raise HTTPException(
                    status_code=400, detail=f"Invalid question_index values: {bad}"
                )

        now = datetime.utcnow()
        submission = Submission(
            exam_id=payload.exam_id,
            student_id=student.id,
            status=SubmissionStatus.submitted,
            submitted_at=now,
            created_at=now,
            updated_at=now,
        )

        answers = [
            Answer(
                question_index=a.question_index,
                answer_text=a.answer_text,
                created_at=now,
                updated_at=now,
            )
            for a in payload.answers
        ]

        try:
            await SubmissionRepository.create_with_answers(
                db, submission=submission, answers=answers
            )
            await db.commit()
            await db.refresh(submission)
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Submission already exists for this exam and student, or duplicate answer index.",
            )

        sub = await SubmissionRepository.get_by_id(db, submission.id)
        return sub

    # ✅ NUOVO: teacher prende submissions per exam (owner-only), con answers
    @staticmethod
    async def list_by_exam_for_teacher_with_answers(
        db: AsyncSession,
        *,
        teacher: User,
        exam_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedSubmissions:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403, detail="Only teachers can access this endpoint."
            )

        # check esistenza exam + owner
        result = await db.execute(select(Exam).where(Exam.id == exam_id))
        exam = result.scalars().first()

        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")
        if exam.teacher_id != teacher.id:
            raise HTTPException(status_code=403, detail="Not allowed.")

        items, total = await SubmissionRepository.list_by_exam_id_for_teacher(
            db,
            exam_id=exam_id,
            teacher_id=teacher.id,
            page=page,
            page_size=page_size,
        )

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedSubmissions(
            items=items,
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )

    # ✅ 2) SOLO TEACHER DELLA SUBJECT
    @staticmethod
    async def list_by_subject_for_teacher(
        db: AsyncSession,
        *,
        teacher: User,
        subject: str,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedSubmissions:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403, detail="Only teachers can access this endpoint."
            )

        if not teacher.subject or teacher.subject != subject:
            raise HTTPException(
                status_code=403,
                detail="You can only view submissions for your subject.",
            )

        items, total = await SubmissionRepository.list_by_subject(
            db, subject=subject, page=page, page_size=page_size
        )

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedSubmissions(
            items=items,
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )

    # ✅ 3) SCOPED: student vede solo sue, teacher vede solo sue exams
    @staticmethod
    async def list_by_student_scoped(
        db: AsyncSession,
        *,
        user: User,
        student_id: int,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedSubmissions:
        if user.role == UserRole.student:
            if user.id != student_id:
                raise HTTPException(
                    status_code=403, detail="You can only view your own submissions."
                )

            items, total = await SubmissionRepository.list_by_student_id(
                db, student_id=student_id, page=page, page_size=page_size
            )

        elif user.role == UserRole.teacher:
            items, total = await SubmissionRepository.list_by_student_id_for_teacher(
                db,
                student_id=student_id,
                teacher_id=user.id,
                page=page,
                page_size=page_size,
            )

        else:
            raise HTTPException(status_code=403, detail="Not enough permissions.")

        page = max(page, 1)
        page_size = min(max(page_size, 1), PAGE_SIZE_MAX)
        total_pages = math.ceil(total / page_size) if total else 0

        return PagedSubmissions(
            items=items,
            meta=PageMeta(
                page=page, page_size=page_size, total=total, total_pages=total_pages
            ),
        )
