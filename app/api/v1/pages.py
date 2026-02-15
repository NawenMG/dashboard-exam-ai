from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter(tags=["pages"])
templates = Jinja2Templates(directory="app/templates")


@router.get("/teacher")
def teacher_home(request: Request):
    return templates.TemplateResponse("teacher/index.html", {"request": request})


@router.get("/student")
def student_home(request: Request):
    return templates.TemplateResponse("student/index.html", {"request": request})


@router.get("/execution-exam/{exam_id}")
def execution_exam_placeholder(request: Request, exam_id: int):
    return templates.TemplateResponse(
        "execution-exam/index.html",
        {"request": request, "exam_id": exam_id},
    )
