from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.schemas.submission import SubmissionCreate, SubmissionOut, PagedSubmissions
from app.services.submission_service import SubmissionService

router = APIRouter(prefix="/submissions", tags=["submissions"])


# 1) SOLO STUDENT
@router.post("", response_model=SubmissionOut, status_code=status.HTTP_201_CREATED)
def create_submission(
    payload: SubmissionCreate,
    db: Session = Depends(get_db),
    student: User = Depends(require_role("student")),
):
    return SubmissionService.create_submission(db, student=student, payload=payload)


@router.get("/by-exam/{exam_id}", response_model=PagedSubmissions)
def list_submissions_by_exam(
    exam_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),  # ✅ era le=50
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return SubmissionService.list_by_exam_for_teacher_with_answers(
        db,
        teacher=teacher,
        exam_id=exam_id,
        page=page,
        page_size=page_size,
    )


# 2) SOLO TEACHER DELLA SUBJECT
@router.get("/by-subject", response_model=PagedSubmissions)
def list_submissions_by_subject(
    subject: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return SubmissionService.list_by_subject_for_teacher(
        db,
        teacher=teacher,
        subject=subject,
        page=page,
        page_size=page_size,
    )


# 3) STUDENT (solo le sue) + TEACHER (solo per i suoi esami)
@router.get("/by-student/{student_id}", response_model=PagedSubmissions)
def list_submissions_by_student(
    student_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return SubmissionService.list_by_student_scoped(
        db,
        user=user,
        student_id=student_id,
        page=page,
        page_size=page_size,
    )
