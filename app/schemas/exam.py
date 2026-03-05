from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class ExamOut(BaseModel):
    id: int
    teacher_id: int
    title: str
    description: Optional[str] = None
    questions_json: Any
    rubric_json: Any
    openai_schema_json: Optional[Any] = None

    # ✅ NEW
    materials_json: Optional[Any] = None

    is_published: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # pydantic v1 (se usi v2: model_config)


class ExamCreate(BaseModel):
    title: str
    description: Optional[str] = None
    questions_json: Any
    rubric_json: Any
    openai_schema_json: Optional[Any] = None

    # ✅ NEW: default None così seed/creazione non devono valorizzarlo
    materials_json: Optional[Any] = None

    is_published: bool = False


class ExamUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    questions_json: Optional[Any] = None
    rubric_json: Optional[Any] = None
    openai_schema_json: Optional[Any] = None

    # ✅ NEW
    materials_json: Optional[Any] = None

    is_published: Optional[bool] = None


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PagedExams(BaseModel):
    items: list[ExamOut]
    meta: PageMeta
