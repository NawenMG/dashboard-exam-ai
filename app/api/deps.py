from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.user import User
from app.core.security import decode_access_token
from app.repositories.revoked_token_repository import RevokedTokenRepository


# Gestione della sessione db, autenticazione dell'utente tramite jwt,
# verifica se il token è revocato e verifica dei ruoli


async def get_db():
    async with SessionLocal() as db:
        yield db


async def get_current_user(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Bearer token"
        )

    token = authorization.split(" ", 1)[1].strip()

    try:
        claims = decode_access_token(token)
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token"
        )

    jti = claims.get("jti")
    if not jti:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token (missing jti)",
        )

    # ✅ async: repository deve essere async e usare await
    if await RevokedTokenRepository.is_revoked(db, jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked"
        )

    user_id = int(claims["sub"])

    # ✅ async: niente db.query(), usa select()
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user


def require_role(*roles: str):
    def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return user

    return role_checker
