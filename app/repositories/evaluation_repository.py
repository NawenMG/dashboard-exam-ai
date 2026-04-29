from datetime import datetime

from sqlalchemy import select, func, update, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.evaluation import Evaluation, EvaluatorType, EvaluationStatus
from app.models.submission import Submission


class EvaluationRepository:
    @staticmethod
    async def create(db: AsyncSession, evaluation: Evaluation) -> Evaluation:
        db.add(evaluation)
        await db.flush()
        return evaluation

    @staticmethod
    async def list_by_submission_id(
        db: AsyncSession, *, submission_id: int
    ) -> list[Evaluation]:
        stmt = (
            select(Evaluation)
            .where(Evaluation.submission_id == submission_id)
            .order_by(Evaluation.evaluator_type.asc(), Evaluation.id.asc())
        )
        result = await db.execute(stmt)
        return result.scalars().all()

    @staticmethod
    async def get_by_submission_and_type(
        db: AsyncSession,
        *,
        submission_id: int,
        evaluator_type: EvaluatorType,
    ) -> Evaluation | None:
        stmt = (
            select(Evaluation)
            .where(Evaluation.submission_id == submission_id)
            .where(Evaluation.evaluator_type == evaluator_type.value)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    # -------------------------
    # PEER QUEUE
    # -------------------------

    @staticmethod
    async def list_peer_assigned(
        db: AsyncSession,
        *,
        student_id: int,
        limit: int,
        exam_id: int | None = None,
    ) -> list[Evaluation]:
        stmt = (
            select(Evaluation)
            .join(Submission, Submission.id == Evaluation.submission_id)
            .where(Evaluation.evaluator_type == EvaluatorType.peer.value)
            .where(Evaluation.evaluator_id == student_id)
            .where(Evaluation.status == EvaluationStatus.assigned.value)
            .where(Submission.peer_reviews_closed_at.is_(None))
        )

        if exam_id is not None:
            stmt = stmt.where(Submission.exam_id == exam_id)

        stmt = stmt.order_by(
            Submission.exam_id.asc(),
            Evaluation.assigned_at.asc(),
            Evaluation.id.asc(),
        ).limit(limit)

        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def get_peer_assignment_for_update(
        db: AsyncSession,
        *,
        student_id: int,
        submission_id: int,
    ) -> Evaluation | None:
        stmt = (
            select(Evaluation)
            .where(Evaluation.evaluator_type == EvaluatorType.peer.value)
            .where(Evaluation.evaluator_id == student_id)
            .where(Evaluation.submission_id == submission_id)
            .with_for_update()
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    # -------------------------
    # CYCLIC PEER ASSIGNMENT
    # -------------------------

    @staticmethod
    async def list_submissions_for_cyclic_peer_assignment(
        db: AsyncSession,
        *,
        exam_id: int,
    ) -> list[Submission]:
        stmt = (
            select(Submission)
            .where(Submission.exam_id == exam_id)
            .where(Submission.submitted_at.isnot(None))
            .where(Submission.peer_reviews_closed_at.is_(None))
            .order_by(Submission.student_id.asc(), Submission.id.asc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()

    @staticmethod
    async def list_existing_peer_assignments_for_exam(
        db: AsyncSession,
        *,
        exam_id: int,
    ) -> set[tuple[int, int]]:
        stmt = (
            select(Evaluation.submission_id, Evaluation.evaluator_id)
            .join(Submission, Submission.id == Evaluation.submission_id)
            .where(Submission.exam_id == exam_id)
            .where(Evaluation.evaluator_type == EvaluatorType.peer.value)
            .where(Evaluation.evaluator_id.isnot(None))
        )
        res = await db.execute(stmt)

        return {
            (int(submission_id), int(evaluator_id))
            for submission_id, evaluator_id in res.all()
            if evaluator_id is not None
        }

    @staticmethod
    async def create_cyclic_peer_assignments(
        db: AsyncSession,
        *,
        pairs: list[tuple[int, int]],
    ) -> list[Evaluation]:
        now = datetime.utcnow()
        rows: list[Evaluation] = []

        for submission_id, evaluator_id in pairs:
            e = Evaluation(
                submission_id=submission_id,
                evaluator_type=EvaluatorType.peer.value,
                evaluator_id=evaluator_id,
                status=EvaluationStatus.assigned.value,
                assigned_at=now,
                completed_at=None,
                score=None,
                comment=None,
                honors=False,
                details_json=None,
                created_at=now,
                updated_at=now,
            )
            db.add(e)
            rows.append(e)

        await db.flush()
        return rows

    # -------------------------
    # PEER AGGREGATION + CLOSE
    # -------------------------

    @staticmethod
    async def peer_stats_for_submission(
        db: AsyncSession, *, submission_id: int
    ) -> dict:
        stmt = (
            select(
                func.count(Evaluation.id).label("count"),
                func.avg(Evaluation.score).label("avg"),
                func.min(Evaluation.score).label("min"),
                func.max(Evaluation.score).label("max"),
            )
            .where(Evaluation.submission_id == submission_id)
            .where(Evaluation.evaluator_type == EvaluatorType.peer.value)
            .where(Evaluation.status == EvaluationStatus.completed.value)
            .where(Evaluation.score.isnot(None))
        )
        row = (await db.execute(stmt)).mappings().one()
        return {
            "count": int(row["count"] or 0),
            "avg": float(row["avg"]) if row["avg"] is not None else None,
            "min": int(row["min"]) if row["min"] is not None else None,
            "max": int(row["max"]) if row["max"] is not None else None,
        }

    @staticmethod
    async def delete_peer_assigned_for_submission(
        db: AsyncSession, *, submission_id: int
    ) -> int:
        stmt = (
            delete(Evaluation)
            .where(Evaluation.submission_id == submission_id)
            .where(Evaluation.evaluator_type == EvaluatorType.peer.value)
            .where(Evaluation.status == EvaluationStatus.assigned.value)
        )
        res = await db.execute(stmt)
        return res.rowcount or 0

    @staticmethod
    async def close_peer_reviews_for_submission(
        db: AsyncSession, *, submission_id: int
    ) -> None:
        stmt = (
            update(Submission)
            .where(Submission.id == submission_id)
            .values(peer_reviews_closed_at=datetime.utcnow())
        )
        await db.execute(stmt)
