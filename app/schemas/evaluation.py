from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class EvaluationCreate(BaseModel):
    submission_id: int
    evaluator_type: str  # "student" | "teacher" | "ai"
    score: int
    honors: bool = False
    comment: str
    details_json: Optional[Any] = None


class EvaluationOut(BaseModel):
    id: int
    submission_id: int
    evaluator_type: str
    score: int
    honors: bool
    comment: str
    details_json: Optional[Any] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EvaluationsBySubmission(BaseModel):
    submission_id: int
    items: list[EvaluationOut]
