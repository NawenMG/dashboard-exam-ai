from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.evaluation import Evaluation, EvaluatorType


class EvaluationRepository:
    # Inserisce una valutazione nel DB (POST)
    @staticmethod
    def create(db: Session, evaluation: Evaluation) -> Evaluation:
        db.add(evaluation)
        db.flush()
        return evaluation

    # Prende una valutazione per id (GET: id)
    @staticmethod
    def list_by_submission_id(db: Session, *, submission_id: int) -> list[Evaluation]:
        stmt = (
            select(Evaluation)
            .where(Evaluation.submission_id == submission_id)
            .order_by(Evaluation.evaluator_type.asc())
        )
        return db.execute(stmt).scalars().all()

    # Prende una specifica valutazione per submisson o type (ai, self o teacher) (GET: Specific)
    @staticmethod
    def get_by_submission_and_type(
        db: Session,
        *,
        submission_id: int,
        evaluator_type: EvaluatorType,
    ) -> Evaluation | None:
        stmt = (
            select(Evaluation)
            .where(Evaluation.submission_id == submission_id)
            .where(Evaluation.evaluator_type == evaluator_type)
        )
        return db.execute(stmt).scalar_one_or_none()
