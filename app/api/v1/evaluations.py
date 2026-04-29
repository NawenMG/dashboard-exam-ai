from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationOut,
    EvaluationsBySubmission,
    PeerTaskOut,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    payload: EvaluationCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return await EvaluationService.create_evaluation(db, user=user, payload=payload)


@router.get("/peer/tasks", response_model=list[PeerTaskOut])
async def get_peer_tasks(
    exam_id: int | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=5),
    db: AsyncSession = Depends(get_db),
    student: User = Depends(require_role("student")),
):
    return await EvaluationService.get_peer_tasks(
        db,
        student=student,
        exam_id=exam_id,
        limit=limit,
    )


@router.post("/peer/generate/{exam_id}", status_code=status.HTTP_200_OK)
async def generate_peer_assignments(
    exam_id: int,
    k: int = Query(default=5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await EvaluationService.generate_cyclic_peer_assignments_for_exam(
        db,
        teacher=teacher,
        exam_id=exam_id,
        k=k,
    )


@router.get("/peer/summary/{submission_id}")
async def get_peer_summary(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await EvaluationService.peer_summary_for_teacher(
        db,
        teacher=teacher,
        submission_id=submission_id,
    )


@router.post("/peer/close/{submission_id}")
async def close_peer_reviews(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await EvaluationService.close_peer_reviews_and_compute(
        db,
        teacher=teacher,
        submission_id=submission_id,
    )


@router.get("/by-submission/{submission_id}", response_model=EvaluationsBySubmission)
async def list_evaluations_by_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return await EvaluationService.list_by_submission_id_for_teacher(
        db,
        teacher=teacher,
        submission_id=submission_id,
    )
