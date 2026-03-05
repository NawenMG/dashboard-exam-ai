from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.submission import Submission
from app.models.exam import Exam
from app.models.evaluation import Evaluation, EvaluatorType, EvaluationStatus
from app.models.final_grade import FinalGrade
from app.repositories.final_grade_repository import FinalGradeRepository
from app.schemas.final_grade import FinalGradeCompute


def _round2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class FinalGradeService:
    # se True: se manca peer blocca compute; se False: renormalizza pesi tra quelli presenti
    REQUIRE_PEER = True

    @staticmethod
    def _avg(scores: list[float]) -> float:
        return sum(scores) / len(scores)

    @staticmethod
    async def compute_and_save(
        db: AsyncSession, *, teacher: User, payload: FinalGradeCompute
    ) -> FinalGrade:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403, detail="Only teachers can compute final grades."
            )

        # load submission
        result = await db.execute(
            select(Submission).where(Submission.id == payload.submission_id)
        )
        submission = result.scalars().first()
        if not submission:
            raise HTTPException(status_code=404, detail="Submission not found.")

        # load exam
        result = await db.execute(select(Exam).where(Exam.id == submission.exam_id))
        exam = result.scalars().first()
        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        # ownership
        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403,
                detail="You can compute final grade only for your exams.",
            )

        # load evaluations
        result = await db.execute(
            select(Evaluation).where(Evaluation.submission_id == submission.id)
        )
        evals = result.scalars().all()

        # --- collect scores (ONLY completed)
        # student: 1 (self)
        student_eval = next(
            (
                e
                for e in evals
                if e.evaluator_type == EvaluatorType.student.value
                and e.status == EvaluationStatus.completed.value
            ),
            None,
        )

        ai_eval = next(
            (
                e
                for e in evals
                if e.evaluator_type == EvaluatorType.ai.value
                and e.status == EvaluationStatus.completed.value
            ),
            None,
        )

        peer_completed = [
            e
            for e in evals
            if e.evaluator_type == EvaluatorType.peer.value
            and e.status == EvaluationStatus.completed.value
            and e.score is not None
        ]

        missing = []
        if not student_eval or student_eval.score is None:
            missing.append("student")
        if not ai_eval or ai_eval.score is None:
            missing.append("ai")
        if FinalGradeService.REQUIRE_PEER and len(peer_completed) == 0:
            missing.append("peer")

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing completed evaluations for submission {submission.id}: {', '.join(missing)}",
            )

        pw = float(payload.peer_weight)
        aw = float(payload.ai_weight)
        sw = float(payload.self_weight)

        if pw < 0 or aw < 0 or sw < 0:
            raise HTTPException(status_code=400, detail="Weights must be >= 0.")

        # scores
        peer_score = None
        if len(peer_completed) > 0:
            peer_score = FinalGradeService._avg(
                [float(e.score) for e in peer_completed]
            )

        ai_score = float(ai_eval.score) if ai_eval else None
        student_score = float(student_eval.score) if student_eval else None

        # weights: se non richiedi peer e manca, renormalizza sui presenti
        parts: list[tuple[float, float]] = []  # (score, weight)
        if peer_score is not None:
            parts.append((peer_score, pw))
        elif FinalGradeService.REQUIRE_PEER:
            # non dovrebbe mai arrivare qui perché sopra blocchiamo
            pass

        if ai_score is not None:
            parts.append((ai_score, aw))
        if student_score is not None:
            parts.append((student_score, sw))

        wsum = sum(w for _, w in parts)
        if wsum <= 0:
            raise HTTPException(status_code=400, detail="Sum of weights must be > 0.")

        final_score_raw = sum(score * w for score, w in parts) / wsum
        final_score = _round2(final_score_raw)

        # honors: true se final_score==30 e almeno una evaluation completed ha honors true
        any_honors = False
        if peer_completed:
            any_honors = any_honors or any(bool(e.honors) for e in peer_completed)
        if ai_eval:
            any_honors = any_honors or bool(ai_eval.honors)
        if student_eval:
            any_honors = any_honors or bool(student_eval.honors)

        final_honors = bool(final_score >= 30 and any_honors)

        fg = FinalGrade(
            submission_id=submission.id,
            peer_weight=pw,
            ai_weight=aw,
            self_weight=sw,
            final_score=final_score,
            final_honors=final_honors,
            computed_at=datetime.utcnow(),
        )

        fg = await FinalGradeRepository.upsert(db, fg)
        await db.commit()
        await db.refresh(fg)
        return fg

    @staticmethod
    async def get_by_submission_id(
        db: AsyncSession, *, user: User, submission_id: int
    ) -> FinalGrade:
        fg = await FinalGradeRepository.get_by_submission_id(db, submission_id)
        if not fg:
            raise HTTPException(
                status_code=404, detail="Final grade not found for this submission."
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

        if user.role == UserRole.student:
            if submission.student_id != user.id:
                raise HTTPException(
                    status_code=403, detail="You can only view your own final grades."
                )
        elif user.role == UserRole.teacher:
            if exam.teacher_id != user.id:
                raise HTTPException(
                    status_code=403,
                    detail="You can only view final grades for your exams.",
                )
        else:
            raise HTTPException(status_code=403, detail="Not enough permissions")

        return fg
