from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

from app.models.evaluation import EvaluatorType


class EvaluationCreate(BaseModel):
    submission_id: int
    evaluator_type: EvaluatorType  # "student" | "peer" | "ai"
    score: int
    honors: bool = False
    comment: str
    details_json: Optional[Any] = None


class EvaluationOut(BaseModel):
    id: int
    submission_id: int
    evaluator_type: EvaluatorType
    evaluator_id: Optional[int] = None
    status: str
    score: Optional[int] = None
    honors: bool
    comment: Optional[str] = None
    details_json: Optional[Any] = None
    assigned_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluationsBySubmission(BaseModel):
    submission_id: int
    items: list[EvaluationOut]


class PeerAnswerOut(BaseModel):
    question_index: int
    answer_text: str


class PeerAnonSubmissionOut(BaseModel):
    id: int
    exam_id: int
    exam_title: Optional[str] = None
    submitted_at: Optional[datetime] = None

    # per renderizzare il modale come “teacher”
    questions_json: Optional[Any] = None
    answers: list[PeerAnswerOut] = []


class PeerTaskOut(BaseModel):
    evaluation_id: int
    submission: PeerAnonSubmissionOut
