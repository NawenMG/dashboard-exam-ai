from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.submission import Submission
from app.models.exam import Exam
from app.models.evaluation import Evaluation, EvaluatorType
from app.models.final_grade import FinalGrade
from app.repositories.final_grade_repository import FinalGradeRepository
from app.schemas.final_grade import FinalGradeCompute


def _round2(x: float) -> float:
    return float(Decimal(str(x)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


class FinalGradeService:
    @staticmethod
    def compute_and_save(
        db: Session, *, teacher: User, payload: FinalGradeCompute
    ) -> FinalGrade:
        if teacher.role != UserRole.teacher:
            raise HTTPException(
                status_code=403, detail="Only teachers can compute final grades."
            )

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

        # ownership teacher (teacher che ha creato l'exam)
        if exam.teacher_id != teacher.id:
            raise HTTPException(
                status_code=403,
                detail="You can compute final grade only for your exams.",
            )

        evals = (
            db.query(Evaluation).filter(Evaluation.submission_id == submission.id).all()
        )
        by_type = {e.evaluator_type: e for e in evals}

        missing = []
        if EvaluatorType.teacher not in by_type:
            missing.append("teacher")
        if EvaluatorType.ai not in by_type:
            missing.append("ai")
        if EvaluatorType.student not in by_type:
            missing.append("student")

        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Missing evaluations for submission {submission.id}: {', '.join(missing)}",
            )

        tw = float(payload.teacher_weight)
        aw = float(payload.ai_weight)
        sw = float(payload.self_weight)

        if tw < 0 or aw < 0 or sw < 0:
            raise HTTPException(status_code=400, detail="Weights must be >= 0.")

        wsum = tw + aw + sw
        if wsum <= 0:
            raise HTTPException(status_code=400, detail="Sum of weights must be > 0.")

        teacher_score = float(by_type[EvaluatorType.teacher].score)
        ai_score = float(by_type[EvaluatorType.ai].score)
        student_score = float(by_type[EvaluatorType.student].score)

        final_score_raw = (
            teacher_score * tw + ai_score * aw + student_score * sw
        ) / wsum
        final_score = _round2(final_score_raw)

        any_honors = (
            bool(by_type[EvaluatorType.teacher].honors)
            or bool(by_type[EvaluatorType.ai].honors)
            or bool(by_type[EvaluatorType.student].honors)
        )
        final_honors = bool(final_score >= 30 and any_honors)

        fg = FinalGrade(
            submission_id=submission.id,
            teacher_weight=tw,
            ai_weight=aw,
            self_weight=sw,
            final_score=final_score,
            final_honors=final_honors,
            computed_at=datetime.utcnow(),
        )

        fg = FinalGradeRepository.upsert(db, fg)
        db.commit()
        db.refresh(fg)
        return fg

    @staticmethod
    def get_by_submission_id(
        db: Session, *, user: User, submission_id: int
    ) -> FinalGrade:
        # 1) prima: esiste il final grade?
        fg = FinalGradeRepository.get_by_submission_id(db, submission_id)
        if not fg:
            raise HTTPException(
                status_code=404, detail="Final grade not found for this submission."
            )

        # 2) carico submission + exam per autorizzazione
        submission = db.query(Submission).filter(Submission.id == submission_id).first()
        if not submission:
            # caso raro: final_grade orfano
            raise HTTPException(status_code=404, detail="Submission not found.")

        exam = db.query(Exam).filter(Exam.id == submission.exam_id).first()
        if not exam:
            raise HTTPException(
                status_code=404, detail="Exam not found for this submission."
            )

        # 3) auth
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
