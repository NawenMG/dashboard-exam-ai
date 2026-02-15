from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.final_grade import FinalGrade


class FinalGradeRepository:
    # Recupera un finale grade associato a una submission (GET: submission)
    @staticmethod
    def get_by_submission_id(db: Session, submission_id: int) -> FinalGrade | None:
        stmt = select(FinalGrade).where(FinalGrade.submission_id == submission_id)
        return db.execute(stmt).scalar_one_or_none()

    # Il final grade può essere creato o modificato se esiste (POST e PUT)
    @staticmethod
    def upsert(db: Session, fg: FinalGrade) -> FinalGrade:
        existing = FinalGradeRepository.get_by_submission_id(db, fg.submission_id)
        if existing:
            existing.teacher_weight = fg.teacher_weight
            existing.ai_weight = fg.ai_weight
            existing.self_weight = fg.self_weight
            existing.final_score = fg.final_score
            existing.final_honors = fg.final_honors
            existing.computed_at = fg.computed_at
            db.flush()
            return existing

        db.add(fg)
        db.flush()
        return fg
