from __future__ import annotations

from typing import Any, Optional
from pydantic import BaseModel, Field


class AIEvaluateRequest(BaseModel):
    model: Optional[str] = Field(
        default=None, description="Ollama model override (optional)"
    )


class AIEvaluateResponse(BaseModel):
    evaluation_id: int
    submission_id: int
    score: int
    honors: bool
    comment: str
    details_json: Optional[Any] = None
