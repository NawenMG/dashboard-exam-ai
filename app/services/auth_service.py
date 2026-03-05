from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password, create_access_token, decode_access_token
from app.models.user import User
from app.repositories.revoked_token_repository import RevokedTokenRepository


def utcnow_naive() -> datetime:
    # naive UTC (compatibile con TIMESTAMP WITHOUT TIME ZONE)
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AuthService:
    @staticmethod
    async def login(db: AsyncSession, *, email: str, password: str) -> str:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()

        if not user or not user.password_hash:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        if not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
            )

        token, _claims = create_access_token(user_id=user.id, role=user.role)
        return token

    @staticmethod
    async def logout(db: AsyncSession, *, token: str) -> None:
        claims = decode_access_token(token)
        jti = claims["jti"]
        user_id = int(claims["sub"])
        exp_ts = int(claims["exp"])

        # exp in naive UTC
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc).replace(
            tzinfo=None
        )
        revoked_at = utcnow_naive()

        if await RevokedTokenRepository.is_revoked(db, jti):
            return

        await RevokedTokenRepository.revoke(
            db,
            jti=jti,
            user_id=user_id,
            expires_at=expires_at,
            revoked_at=revoked_at,
        )
        await db.commit()
