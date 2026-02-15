import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.submission import Submission
from app.models.exam import Exam
from app.models.evaluation import Evaluation, EvaluatorType
from app.repositories.evaluation_repository import EvaluationRepository
from app.schemas.evaluation import EvaluationCreate, EvaluationsBySubmission


def _to_json_str(data) -> str | None:
    if data is None:
        return None
    # se già dict/list ok
    if isinstance(data, (dict, list)):
        return json.dumps(data, ensure_ascii=False)
    # se è stringa la salviamo com'è (ma meglio evitare)
    if isinstance(data, str):
        return data
    return json.dumps(data, ensure_ascii=False)


def _from_json_maybe(value):
    if value is None:
        return None
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return value
    return value


class EvaluationService:
    @staticmethod
    def create_evaluation(
        db: Session, *, user: User, payload: EvaluationCreate
    ) -> Evaluation:
        # valida evaluator_type
        try:
            etype = EvaluatorType(payload.evaluator_type)
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid evaluator_type. Use: student|teacher|ai",
            )

        # 🚫 AI evaluation NON passa da qui
        if etype == EvaluatorType.ai:
            raise HTTPException(
                status_code=400,
                detail="AI evaluation must be created via /ai-evaluations/{submission_id}.",
            )

        # carica submission + exam per permessi/ownership
        submission = (
            db.query(Submission).filter(Submission.id == payload.submission_id).first()
        )
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = db.query(Exam).filter(Exam.id == submission.exam_id).first()
        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        # PERMESSI
        if etype == EvaluatorType.student:
            if user.role != UserRole.student:
                raise HTTPException(
                    status_code=403,
                    detail="Only students can create student evaluation.",
                )
            if submission.student_id != user.id:
                raise HTTPException(
                    status_code=403, detail="You can evaluate only your own submission."
                )

        if etype == EvaluatorType.teacher:
            if user.role != UserRole.teacher:
                raise HTTPException(
                    status_code=403,
                    detail="Only teachers can create teacher evaluation.",
                )
            if exam.teacher_id != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You can evaluate only submissions of your exams.",
                )

        now = datetime.utcnow()

        evaluation = Evaluation(
            submission_id=submission.id,
            evaluator_type=etype,
            score=payload.score,
            honors=payload.honors,
            comment=payload.comment,
            details_json=_to_json_str(payload.details_json),
            created_at=now,
            updated_at=now,
        )

        try:
            EvaluationRepository.create(db, evaluation)
            db.commit()
            db.refresh(evaluation)
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Evaluation already exists for this submission and evaluator_type.",
            )

        evaluation.details_json = _from_json_maybe(evaluation.details_json)
        return evaluation

    @staticmethod
    def list_by_submission_id_for_teacher(
        db: Session, *, teacher: User, submission_id: int
    ) -> EvaluationsBySubmission:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403,
                detail="Only teachers can view evaluations by submission.",
            )

        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = db.query(Exam).filter(Exam.id == submission.exam_id).first()
        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        # ✅ ownership
        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can only view evaluations for your exams."
            )

        items = EvaluationRepository.list_by_submission_id(
            db, submission_id=submission_id
        )

        for e in items:
            e.details_json = _from_json_maybe(e.details_json)

        return EvaluationsBySubmission(submission_id=submission_id, items=items)
