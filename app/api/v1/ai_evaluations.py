from fastapi import APIRouter, Depends, status, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.ai_evaluation import AIEvaluateRequest, AIEvaluateResponse
from app.services.ai_evaluation_service import AIEvaluationService

router = APIRouter(prefix="/ai-evaluations", tags=["ai_evaluations"])


@router.post(
    "/{submission_id}",
    response_model=AIEvaluateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def run_ai_evaluation(
    submission_id: int,
    payload: AIEvaluateRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    evaluation, created = await AIEvaluationService.run_ai_evaluation(
        db,
        teacher=teacher,
        submission_id=submission_id,
        model=payload.model,
    )

    # se già esisteva → 200 invece di 201
    if not created:
        response.status_code = status.HTTP_200_OK

    return AIEvaluateResponse(
        evaluation_id=evaluation.id,
        submission_id=evaluation.submission_id,
        score=evaluation.score,
        honors=evaluation.honors,
        comment=evaluation.comment,
        details_json=evaluation.details_json,
    )
