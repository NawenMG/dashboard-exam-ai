from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.exam import ExamCreate, ExamUpdate, ExamOut, PagedExams
from app.services.exam_service import ExamService

router = APIRouter(prefix="/exams", tags=["exams"])


@router.post("", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam(
    payload: ExamCreate,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await ExamService.create_exam(db, teacher=teacher, payload=payload)


@router.post("/draft", response_model=ExamOut, status_code=status.HTTP_201_CREATED)
async def create_exam_draft(
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await ExamService.create_draft(db, teacher=teacher)


@router.get("/mine", response_model=PagedExams)
async def list_my_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await ExamService.list_my_exams(
        db, teacher=teacher, page=page, page_size=page_size
    )


@router.get("/published", response_model=PagedExams)
async def list_published_exams(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await ExamService.list_published_exams(db, page=page, page_size=page_size)


@router.get("", response_model=PagedExams)
async def list_exams_by_subject(
    subject: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    teacher_id = user.id if user.role == UserRole.teacher else None
    return await ExamService.list_exams_by_subject(
        db, subject=subject, page=page, page_size=page_size, teacher_id=teacher_id
    )


@router.put("/{exam_id}", response_model=ExamOut)
async def update_exam(
    exam_id: int,
    payload: ExamUpdate,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await ExamService.update_exam(
        db, teacher=teacher, exam_id=exam_id, payload=payload
    )


@router.delete("/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_exam(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    await ExamService.delete_exam(db, teacher=teacher, exam_id=exam_id)
    return None
