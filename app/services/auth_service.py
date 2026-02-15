from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import verify_password, create_access_token, decode_access_token
from app.models.user import User
from app.repositories.revoked_token_repository import RevokedTokenRepository


class AuthService:
    @staticmethod
    def login(db: Session, *, email: str, password: str) -> str:
        user = db.query(User).filter(User.email == email).first()
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
    def logout(db: Session, *, token: str) -> None:
        # decodifica e prende jti + exp
        claims = decode_access_token(token)
        jti = claims["jti"]
        user_id = int(claims["sub"])
        exp_ts = int(claims["exp"])
        expires_at = datetime.fromtimestamp(exp_ts, tz=timezone.utc)
        now = datetime.now(timezone.utc)

        if RevokedTokenRepository.is_revoked(db, jti):
            return  # idempotente

        RevokedTokenRepository.revoke(
            db,
            jti=jti,
            user_id=user_id,
            expires_at=expires_at,
            revoked_at=now,
        )
        db.commit()
