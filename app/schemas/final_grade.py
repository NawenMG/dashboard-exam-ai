from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FinalGradeCompute(BaseModel):
    submission_id: int
    teacher_weight: float = 0.60
    ai_weight: float = 0.30
    self_weight: float = 0.10


class FinalGradeOut(BaseModel):
    submission_id: int
    teacher_weight: float
    ai_weight: float
    self_weight: float
    final_score: float
    final_honors: bool
    computed_at: datetime

    class Config:
        from_attributes = True
