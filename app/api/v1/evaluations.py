from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.schemas.evaluation import (
    EvaluationCreate,
    EvaluationOut,
    EvaluationsBySubmission,
)
from app.services.evaluation_service import EvaluationService

router = APIRouter(prefix="/evaluations", tags=["evaluations"])


@router.post("", response_model=EvaluationOut, status_code=status.HTTP_201_CREATED)
def create_evaluation(
    payload: EvaluationCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return EvaluationService.create_evaluation(db, user=user, payload=payload)


@router.get("/by-submission/{submission_id}", response_model=EvaluationsBySubmission)
def list_evaluations_by_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return EvaluationService.list_by_submission_id_for_teacher(
        db, teacher=teacher, submission_id=submission_id
    )
