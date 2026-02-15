from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AnswerCreate(BaseModel):
    question_index: int
    answer_text: str


class AnswerOut(BaseModel):
    id: int
    question_index: int
    answer_text: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubmissionCreate(BaseModel):
    exam_id: int
    answers: list[AnswerCreate]


# ✅ NEW: mini schema per student dentro la submission
class StudentMini(BaseModel):
    id: int
    first_name: str
    last_name: str
    matricola: str | None = None

    class Config:
        from_attributes = True


class SubmissionOut(BaseModel):
    id: int
    exam_id: int
    student_id: int
    status: str
    submitted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    answers: list[AnswerOut]

    # ✅ NEW: info studente (nome/cognome/matricola)
    student: StudentMini | None = None

    class Config:
        from_attributes = True


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PagedSubmissions(BaseModel):
    items: list[SubmissionOut]
    meta: PageMeta
