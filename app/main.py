from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.api.v1.users import router as users_router
from app.api.v1.exams import router as exams_router
from app.api.v1.submissions import router as submissions_router
from app.api.v1.evaluations import router as evaluations_router
from app.api.v1.final_grades import router as final_grades_router
from app.api.v1.ai_evaluations import router as ai_evaluations_router
from app.api.v1.auth import router as auth_router
from app.api.v1.pages import router as pages_router
from app.api.v1.materials import router as materials_router


app = FastAPI(
    title="FastAPI Research Project",
    version="1.0.0",
    debug=True,
)

# =========================================================
# Paths robusti (indipendenti da dove lanci uvicorn)
# =========================================================
BASE_DIR = Path(__file__).resolve().parent  # .../fastapi-project/app
STATIC_DIR = BASE_DIR / "static"  # .../fastapi-project/app/static
TEMPLATES_DIR = BASE_DIR / "templates"  # .../fastapi-project/app/templates

# sicurezza: crea static se non esiste
STATIC_DIR.mkdir(parents=True, exist_ok=True)

# =========================================================
# Static files  ->  /static/*
# =========================================================
app.mount(
    "/static",
    StaticFiles(directory=str(STATIC_DIR)),
    name="static",
)

# =========================================================
# Templates
# =========================================================
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


# =========================================================
# Entry point
# =========================================================
@app.get("/", response_class=HTMLResponse)
def home(request: Request):
    return templates.TemplateResponse(
        "dashboard_base.html",
        {"request": request},
    )


# =========================================================
# API Routers
# =========================================================
app.include_router(users_router)
app.include_router(exams_router)
app.include_router(submissions_router)
app.include_router(evaluations_router)
app.include_router(final_grades_router)
app.include_router(ai_evaluations_router)
app.include_router(auth_router)
app.include_router(materials_router)


# Pages (dashboard)
app.include_router(pages_router, prefix="/dashboard")
