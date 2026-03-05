from fastapi import APIRouter, Depends, status, Header, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db, get_current_user
from app.models.user import User

from app.schemas.auth import (
    LoginRequest,
    TokenResponse,
    LogoutResponse,
    MeResponse,
)

from app.services.auth_service import AuthService


router = APIRouter(prefix="/auth", tags=["auth"])

# templates engine
templates = Jinja2Templates(directory="app/templates")


# ----------------------------
# GET /auth/login -> HTML page
# ----------------------------
@router.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "title": "Login",
        },
    )


# ----------------------------
# POST /auth/login -> JWT API
# ----------------------------
@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
)
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    token = await AuthService.login(
        db,
        email=payload.email,
        password=payload.password,
    )

    return TokenResponse(access_token=token)


# ----------------------------
# POST /auth/logout -> revoke token
# ----------------------------
@router.post(
    "/logout",
    response_model=LogoutResponse,
    status_code=status.HTTP_200_OK,
)
async def logout(
    db: AsyncSession = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Bearer token",
        )

    token = authorization.split(" ", 1)[1].strip()

    await AuthService.logout(db, token=token)

    return LogoutResponse(detail="Logged out")


# ----------------------------
# GET /auth/me -> current user info
# ----------------------------
@router.get(
    "/me",
    response_model=MeResponse,
    status_code=status.HTTP_200_OK,
)
def get_me(
    current_user: User = Depends(get_current_user),
):
    return MeResponse(
        id=current_user.id,
        role=current_user.role,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        email=current_user.email,
    )
