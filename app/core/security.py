# Core per il sistema di autenticazione
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Tuple

import jwt  # PyJWT
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Verifica del login
def verify_password(plain_password: str, password_hash: str) -> bool:
    return pwd_context.verify(plain_password, password_hash)


# Carica la chiave privata
def _load_private_key() -> str:
    return Path(settings.JWT_PRIVATE_KEY_PATH).read_text(encoding="utf-8")


# Carica la chiave pubblica
def _load_public_key() -> str:
    return Path(settings.JWT_PUBLIC_KEY_PATH).read_text(encoding="utf-8")


# Creatione del jwt con user id e role
def create_access_token(*, user_id: int, role: str) -> Tuple[str, Dict[str, Any]]:
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = str(uuid.uuid4())

    payload: Dict[str, Any] = {
        "iss": settings.JWT_ISSUER,
        "aud": settings.JWT_AUDIENCE,
        "sub": str(user_id),
        "role": role,
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }

    token = jwt.encode(payload, _load_private_key(), algorithm=settings.JWT_ALG)
    return token, payload


# Verifica il token
def decode_access_token(token: str) -> Dict[str, Any]:
    # PyJWT valida exp/iat/nbf automaticamente se presenti
    return jwt.decode(
        token,
        _load_public_key(),
        algorithms=[settings.JWT_ALG],
        audience=settings.JWT_AUDIENCE,
        issuer=settings.JWT_ISSUER,
        options={"require": ["exp", "iat", "sub", "jti"]},
    )
