import json
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.evaluation import Evaluation, EvaluatorType
from app.models.exam import Exam
from app.models.submission import Submission, SubmissionStatus
from app.models.user import User, UserRole
from app.repositories.evaluation_repository import EvaluationRepository
from app.services.ai_service import (
    build_items_for_prompt,
    normalize_questions,
    normalize_rubric,
)
from app.services.vectors.rag_grading_service import RAGGradingService


def _dumps_json(value):
    if value is None:
        return None
    return json.dumps(value, ensure_ascii=False)


class AIEvaluationService:
    @staticmethod
    async def run_ai_evaluation(
        db: AsyncSession,
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

        result = await db.execute(
            select(Submission).where(Submission.id == submission_id)
        )
        submission = result.scalars().first()

        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        result = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
        exam = result.scalars().first()

        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403, detail="You can run AI eval only for your exams."
            )

        # CHECK EXISTING → idempotente
        existing = await EvaluationRepository.get_by_submission_and_type(
            db,
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai,
        )

        if existing:
            if isinstance(existing.details_json, str) and existing.details_json:
                try:
                    existing.details_json = json.loads(existing.details_json)
                except Exception:
                    pass
            return existing, False

        # crea nuova evaluation

        answers_result = await db.execute(
            select(Answer)
            .where(Answer.submission_id == submission.id)
            .order_by(Answer.question_index.asc())
        )
        answers = answers_result.scalars().all()

        answers_by_index = {a.question_index: (a.answer_text or "") for a in answers}

        questions = normalize_questions(exam.questions_json)
        rubric = normalize_rubric(exam.rubric_json)

        qa_items = build_items_for_prompt(
            questions,
            answers_by_index,
        )

        # MVP: version fissa (poi la leghiamo a exam.materials_version o tabella materials)
        materials_version = 1

        # Grounded grading (retrieval + prompt + Ollama)
        try:
            out = await RAGGradingService.grade_submission_grounded(
                exam_id=exam.id,
                materials_version=materials_version,
                exam_title=exam.title,
                exam_description=exam.description,
                rubric=rubric,
                qa_items=qa_items,
                model=model,
                schema_format=getattr(exam, "openai_schema_json", None),
                top_k=8,
                num_predict=512,
                keep_alive="10m",
            )
        except Exception as e:
            # mappa l'errore su 503 (dipendenza esterna: Ollama/Qdrant)
            raise HTTPException(
                status_code=503, detail=f"AI/RAG evaluation failed: {e}"
            )

        result = out.ai_result
        used_chunks = out.used_chunks

        # Salviamo audit RAG senza migrazioni: details_json include sia breakdown AI che chunk usati
        details_payload = {
            "details_json": result.get("details_json"),
            "rag": {
                "materials_version": materials_version,
                "top_k": 8,
                "used_chunks": [
                    {
                        "chunk_id": c.chunk_id,
                        "material_id": c.material_id,
                        "source_ref": c.source_ref,
                        "page": c.page,
                        "score": c.score,
                    }
                    for c in used_chunks
                ],
            },
        }

        now = datetime.utcnow()

        evaluation = Evaluation(
            submission_id=submission.id,
            evaluator_type=EvaluatorType.ai,
            score=int(result["score"]),
            honors=bool(result["honors"]),
            comment=result.get("comment"),
            details_json=_dumps_json(details_payload),
            created_at=now,
            updated_at=now,
        )

        try:
            db.add(evaluation)
            await db.flush()

            submission.status = SubmissionStatus.ai_done
            submission.updated_at = now

            await db.commit()
            await db.refresh(evaluation)

        except IntegrityError:
            await db.rollback()

            existing = await EvaluationRepository.get_by_submission_and_type(
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
