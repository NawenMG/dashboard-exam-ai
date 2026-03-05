from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.final_grade import FinalGrade


class FinalGradeRepository:
    @staticmethod
    async def get_by_submission_id(
        db: AsyncSession, submission_id: int
    ) -> FinalGrade | None:
        stmt = select(FinalGrade).where(FinalGrade.submission_id == submission_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    @staticmethod
    async def upsert(db: AsyncSession, fg: FinalGrade) -> FinalGrade:
        existing = await FinalGradeRepository.get_by_submission_id(db, fg.submission_id)
        if existing:
            existing.peer_weight = fg.peer_weight
            existing.ai_weight = fg.ai_weight
            existing.self_weight = fg.self_weight
            existing.final_score = fg.final_score
            existing.final_honors = fg.final_honors
            existing.computed_at = fg.computed_at
            await db.flush()
            return existing

        db.add(fg)
        await db.flush()
        return fg
