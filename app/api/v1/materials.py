# app/api/v1/materials.py
import os
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.api.deps import get_db, require_role
from app.models.exam import Exam
from app.models.user import User
from app.services.vectors.material_ingestion_service import (
    MaterialIngestionService,
    MaterialIngestionError,
)

router = APIRouter(prefix="/exams", tags=["materials"])

STORAGE_DIR = os.getenv("MATERIALS_STORAGE_DIR", "/app/storage/materials")


def utc_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _ensure_list(v: Any) -> list[dict]:
    return v if isinstance(v, list) else []


def _sort_items(items: list[dict]) -> list[dict]:
    # più recenti prima (material_id è un timestamp)
    try:
        return sorted(items, key=lambda x: int(x.get("id", 0)), reverse=True)
    except Exception:
        return items


async def _get_exam_owned(db: AsyncSession, exam_id: int, teacher: User) -> Exam:
    res = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = res.scalars().first()
    if not exam:
        raise HTTPException(status_code=404, detail="Exam not found.")
    if exam.teacher_id != teacher.id:
        raise HTTPException(status_code=403, detail="Not allowed for this exam.")
    return exam


def _find_material(items: list[dict], material_id: int) -> dict | None:
    for it in items:
        try:
            if int(it.get("id")) == int(material_id):
                return it
        except Exception:
            continue
    return None


@router.get("/{exam_id}/materials")
async def list_exam_materials(
    exam_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = await _get_exam_owned(db, exam_id, teacher)
    items = _sort_items(_ensure_list(exam.materials_json))
    return {"items": items}


@router.get("/{exam_id}/materials/{material_id}/download")
async def download_exam_material(
    exam_id: int,
    material_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = await _get_exam_owned(db, exam_id, teacher)
    items = _ensure_list(exam.materials_json)
    mat = _find_material(items, material_id)
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found.")

    path = mat.get("storage_path")
    if not path or not isinstance(path, str) or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Material file not found on disk.")

    filename = mat.get("filename") or f"material_{material_id}.pdf"
    return FileResponse(
        path=path,
        media_type="application/pdf",
        filename=filename,
    )


@router.post(
    "/{exam_id}/materials/pdf",
    status_code=status.HTTP_201_CREATED,
)
async def upload_exam_material_pdf(
    exam_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = await _get_exam_owned(db, exam_id, teacher)

    filename = file.filename or "material.pdf"
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF is supported for now.")

    os.makedirs(STORAGE_DIR, exist_ok=True)
    safe_name = f"{exam_id}_{uuid.uuid4().hex}.pdf"
    path = os.path.join(STORAGE_DIR, safe_name)

    try:
        content = await file.read()
        with open(path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    material_id = int(datetime.utcnow().timestamp())
    version = 1

    try:
        chunks = await MaterialIngestionService.ingest_pdf(
            exam_id=exam_id,
            material_id=material_id,
            version=version,
            file_path=path,
        )
    except MaterialIngestionError as e:
        raise HTTPException(status_code=500, detail=str(e))

    items = _ensure_list(exam.materials_json)
    items.append(
        {
            "id": material_id,
            "version": version,
            "filename": filename,
            "storage_path": path,
            "uploaded_at": utc_iso(),
            "chunks_created": len(chunks),
        }
    )

    exam.materials_json = items
    flag_modified(exam, "materials_json")

    await db.commit()
    await db.refresh(exam)

    return {
        "exam_id": exam_id,
        "material_id": material_id,
        "version": version,
        "filename": filename,
        "file_path": path,
        "chunks_created": len(chunks),
        "materials_json": _sort_items(_ensure_list(exam.materials_json)),
    }


@router.delete(
    "/{exam_id}/materials/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_exam_material(
    exam_id: int,
    material_id: int,
    db: AsyncSession = Depends(get_db),
    teacher: User = Depends(require_role("teacher")),
):
    exam = await _get_exam_owned(db, exam_id, teacher)
    items = _ensure_list(exam.materials_json)

    mat = _find_material(items, material_id)
    if not mat:
        raise HTTPException(status_code=404, detail="Material not found.")

    # best-effort: cancella file
    try:
        path = mat.get("storage_path")
        if path and isinstance(path, str) and os.path.exists(path):
            os.remove(path)
    except Exception:
        pass

    kept = [it for it in items if str(it.get("id")) != str(material_id)]
    exam.materials_json = kept
    flag_modified(exam, "materials_json")
    await db.commit()
    return
