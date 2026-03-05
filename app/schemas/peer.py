# app/schemas/peer.py

from pydantic import BaseModel
from typing import Any


class PeerSubmissionAnon(BaseModel):
    id: int
    exam_title: str
    questions_json: Any
    answers: list[dict]  # oppure un DTO AnswerOut minimale


class PeerTaskOut(BaseModel):
    submission: PeerSubmissionAnon
