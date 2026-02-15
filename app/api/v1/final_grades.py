from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.user import User
from app.schemas.final_grade import FinalGradeCompute, FinalGradeOut
from app.services.final_grade_service import FinalGradeService

router = APIRouter(prefix="/final-grades", tags=["final_grades"])


@router.post("", response_model=FinalGradeOut, status_code=status.HTTP_201_CREATED)
def compute_final_grade(
    payload: FinalGradeCompute,
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    return FinalGradeService.compute_and_save(db, teacher=teacher, payload=payload)


@router.get("/by-submission/{submission_id}", response_model=FinalGradeOut)
def get_final_grade_by_submission(
    submission_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return FinalGradeService.get_by_submission_id(
        db, user=user, submission_id=submission_id
    )
