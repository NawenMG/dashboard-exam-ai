from fastapi import APIRouter, Depends, Query, Request
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.user import User
from app.schemas.user import PagedUsers
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])

# Se hai già templates condiviso altrove, importa quello invece di ricrearlo
templates = Jinja2Templates(directory="app/templates")


# =========================================================
# VIEW ROUTES (HTML)
# =========================================================


@router.get("")
def users_view(
    request: Request,
    teacher: User = Depends(require_role("teacher")),
):
    """
    View (teacher): Pokédex studenti.
    La pagina poi chiamerà via JS l'API /users/students con filtri/paginazione.
    """
    return templates.TemplateResponse("users.html", {"request": request})


# (OPZIONALE) Se vuoi una view analoga per studenti (lista docenti)
@router.get("/teachers-view")
def teachers_view(
    request: Request,
    student: User = Depends(require_role("student")),
):
    """
    View (student): lista docenti (opzionale).
    La pagina poi chiamerà via JS l'API /users/teachers.
    """
    return templates.TemplateResponse("users_teachers.html", {"request": request})


# =========================================================
# API ROUTES (JSON)
# =========================================================


@router.get("/students", response_model=PagedUsers)
def list_students(
    db: Session = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),  # ✅ solo teacher
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    first_name: str | None = Query(None),
    last_name: str | None = Query(None),
    email: str | None = Query(None),
    matricola: str | None = Query(None),
):
    """
    Per docenti: lista studenti con filtri LIKE opzionali.
    Paginazione: page/page_size.
    """
    return UserService.get_students(
        db,
        page=page,
        page_size=page_size,
        first_name=first_name,
        last_name=last_name,
        email=email,
        matricola=matricola,
    )


@router.get("/teachers", response_model=PagedUsers)
def list_teachers(
    db: Session = Depends(get_db),
    student: User = Depends(require_role("student")),  # ✅ solo student
    page: int = Query(1, ge=1),
    page_size: int = Query(5, ge=1, le=50),
    first_name: str | None = Query(None),
    last_name: str | None = Query(None),
    subject: str | None = Query(None),
):
    """
    Per studenti: lista docenti con filtri LIKE opzionali.
    Paginazione: page/page_size.
    """
    return UserService.get_teachers(
        db,
        page=page,
        page_size=page_size,
        first_name=first_name,
        last_name=last_name,
        subject=subject,
    )
