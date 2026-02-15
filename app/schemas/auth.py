from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LogoutResponse(BaseModel):
    detail: str


# NEW: risposta per /auth/me
class MeResponse(BaseModel):
    id: int
    role: str
    first_name: str
    last_name: str
    email: EmailStr
