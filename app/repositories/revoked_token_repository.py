from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.revoked_token import RevokedToken


class RevokedTokenRepository:
    # Verifica se un token è stato revocato (GET)
    @staticmethod
    async def is_revoked(db: AsyncSession, jti: str) -> bool:
        stmt = (
            select(RevokedToken)
            .where(
                RevokedToken.jti == jti,
                RevokedToken.is_active.is_(True),
            )
            .limit(1)
        )
        result = await db.execute(stmt)
        row = result.scalars().first()
        return row is not None

    # Per revocare un token inserendolo in una blacklist (DELETE/PUT)
    @staticmethod
    async def revoke(
        db: AsyncSession,
        *,
        jti: str,
        user_id: int,
        expires_at: datetime,
        revoked_at: datetime,
    ) -> RevokedToken:
        row = RevokedToken(
            jti=jti,
            user_id=user_id,
            revoked_at=revoked_at,
            expires_at=expires_at,
            is_active=True,
        )
        db.add(row)

        # in async, flush è awaitable
        await db.flush()

        return row
