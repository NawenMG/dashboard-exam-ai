import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.answer import Answer
from app.models.evaluation import Evaluation, EvaluatorType
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User, UserRole
from app.repositories.evaluation_repository import EvaluationRepository
from app.services.ai_service import (
    normalize_questions,
    normalize_rubric,
    build_items_for_prompt,
    build_prompt,
    evaluate_with_ollama,
)


def _dumps_json(value):
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


# da submission → chiamata AI → salvataggio evaluation AI → aggiornamento stato submission


class AIEvaluationService:
    @staticmethod
    async def run_ai_evaluation(
        db: Session,
        *,
        teacher: User,
        submission_id: int,
        model: str | None = None,
    ) -> tuple[Evaluation, bool]:
        """
        Returns:
            (evaluation, created_bool)
        """

        # permessi
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403, detail="Only teachers can run AI evaluation."
            )

        submission = db.query(Submission).filter(Submission.id == submission_id).first()

        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = db.query(Exam).filter(Exam.id == submission.exam_id).first()

        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can run AI eval only for your exams."
            )

        # 🔥 CHECK EXISTING → IDPOTENTE
        existing = EvaluationRepository.get_by_submission_and_type(
            db,
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai,
        )

        if existing:
            # restituisce esistente senza crearne uno nuovo
            if isinstance(existing.details_json, str) and existing.details_json:
                try:
                    existing.details_json = json.loads(existing.details_json)
                except Exception:
                    pass

            return existing, False

        # --- crea nuova evaluation ---

        answers = (
            db.query(Answer)
            .filter(Answer.submission_id == submission.id)
            .order_by(Answer.question_index.asc())
            .all()
        )

        answers_by_index = {a.question_index: (a.answer_text or "") for a in answers}

        questions = normalize_questions(exam.questions_json)
        rubric = normalize_rubric(exam.rubric_json)

        qa_items = build_items_for_prompt(
            questions,
            answers_by_index,
        )

        prompt = build_prompt(
            exam_title=exam.title,
            exam_description=exam.description,
            rubric=rubric,
            qa_items=qa_items,
        )

        schema_format = exam.openai_schema_json

        result = await evaluate_with_ollama(
            model=model,
            prompt=prompt,
            schema_format=schema_format,
            num_predict=512,
            keep_alive="10m",
        )

        now = datetime.utcnow()

        evaluation = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai,
            score=int(result["score"]),
            honors=bool(result["honors"]),
            comment=str(result["comment"]),
            details_json=_dumps_json(result.get("details_json")),
            created_at=now,
            updated_at=now,
        )

        try:
            db.add(evaluation)
            db.flush()

            submission.status = SubmissionStatus.ai_done
            submission.updated_at = now

            db.commit()
            db.refresh(evaluation)

        except IntegrityError:
            db.rollback()

            existing = EvaluationRepository.get_by_submission_and_type(
                db,
                submission_id=submission.id,
                evaluator_type=EvaluatorType.ai,
            )

            return existing, False

        if isinstance(evaluation.details_json, str) and evaluation.details_json:
            try:
                evaluation.details_json = json.loads(evaluation.details_json)
            except Exception:
                pass

        return evaluation, True
