import json
import math
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.exam import Exam
from app.models.user import User
from app.repositories.exam_repository import (
    ExamRepository,
    PAGE_SIZE_DEFAULT,
    PAGE_SIZE_MAX,
)
from app.schemas.exam import ExamCreate, ExamUpdate, PagedExams, PageMeta, ExamOut


def _to_json_str(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False)


def _from_json_str(data: str | None) -> dict | None:
    if data is None:
        return None
    return json.loads(data)


def _exam_to_out(exam: Exam) -> ExamOut:
    return ExamOut(
        id=exam.id,
        teacher_id=exam.teacher_id,
        title=exam.title,
        description=exam.description,
        questions_json=_from_json_str(exam.questions_json) or {},
        rubric_json=_from_json_str(exam.rubric_json) or {},
        openai_schema_json=_from_json_str(exam.openai_schema_json),
        is_published=bool(exam.is_published),
        created_at=exam.created_at,
        updated_at=exam.updated_at,
    )


class ExamService:
    @staticmethod
    def create_exam(db: Session, *, teacher: User, payload: ExamCreate) -> ExamOut:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can create exams."
            )

        exam = Exam(
            teacher_id=teacher.id,
            title=payload.title,
            description=payload.description,
            questions_json=_to_json_str(payload.questions_json),
            rubric_json=_to_json_str(payload.rubric_json),
            openai_schema_json=(
                _to_json_str(payload.openai_schema_json)
                if payload.openai_schema_json
                else None
            ),
            is_published=payload.is_published,
        )

        ExamRepository.create(db, exam)
        db.commit()
        db.refresh(exam)
        return _exam_to_out(exam)

    @staticmethod
    def list_exams_by_subject(
        db: Session,
        *,
        subject: str,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
        teacher_id: int | None = None,
    ) -> PagedExams:
        items, total = ExamRepository.list_by_subject(
            db,
            subject=subject,
            page=page,
            page_size=page_size,
            teacher_id=teacher_id,
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

    # ✅ NEW: lista esami del teacher loggato, senza subject
    @staticmethod
    def list_my_exams(
        db: Session,
        *,
        teacher: User,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedExams:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can list their exams."
            )

        items, total = ExamRepository.list_by_teacher(
            db,
            teacher_id=teacher.id,
            page=page,
            page_size=page_size,
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

    # ✅ NEW: lista di TUTTI gli esami pubblicati (senza subject)
    @staticmethod
    def list_published_exams(
        db: Session,
        *,
        page: int = 1,
        page_size: int = PAGE_SIZE_DEFAULT,
    ) -> PagedExams:
        items, total = ExamRepository.list_published(
            db,
            page=page,
            page_size=page_size,
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
    def update_exam(
        db: Session,
        *,
        teacher: User,
        exam_id: int,
        payload: ExamUpdate,
    ) -> ExamOut:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can update exams."
            )

        exam = ExamRepository.get_by_id(db, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can only update your own exams."
            )

        data = payload.model_dump(exclude_unset=True)

        if "questions_json" in data and data["questions_json"] is not None:
            data["questions_json"] = _to_json_str(data["questions_json"])
        if "rubric_json" in data and data["rubric_json"] is not None:
            data["rubric_json"] = _to_json_str(data["rubric_json"])
        if "openai_schema_json" in data:
            if data["openai_schema_json"] is None:
                data["openai_schema_json"] = None
            else:
                data["openai_schema_json"] = _to_json_str(data["openai_schema_json"])

        ExamRepository.update_fields(exam, data)
        db.commit()
        db.refresh(exam)
        return _exam_to_out(exam)

    @staticmethod
    def delete_exam(db: Session, *, teacher: User, exam_id: int) -> None:
        if teacher.role != "teacher":
            raise HTTPException(
                status_code=403, detail="Only teachers can delete exams."
            )

        exam = ExamRepository.get_by_id(db, exam_id)
        if not exam:
            raise HTTPException(status_code=404, detail="Exam not found.")

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can only delete your own exams."
            )

        ExamRepository.delete(db, exam)
        db.commit()
