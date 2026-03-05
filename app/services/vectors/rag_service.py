# app/services/rag_service.py

import os
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

from app.services.vectors.material_ingestion_service import (
    MaterialIngestionError,
    ollama_embed,
)

# =========================
# Config
# =========================

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "exam_material_chunks")

DEFAULT_TOP_K = int(os.getenv("RAG_TOP_K", "8"))
DEFAULT_QUERY_TIMEOUT_S = float(os.getenv("RAG_QUERY_TIMEOUT_S", "30"))


# =========================
# Errors
# =========================


class RAGRetrievalError(Exception):
    pass


# =========================
# Data
# =========================


@dataclass
class RetrievedChunk:
    chunk_id: str
    text: str
    source_ref: str
    score: float
    exam_id: int
    material_id: int
    version: int
    page: Optional[int] = None


# =========================
# Qdrant call
# =========================


async def qdrant_search(
    client: httpx.AsyncClient,
    *,
    query_vector: List[float],
    exam_id: int,
    version: int,
    top_k: int,
    with_payload: bool = True,
    timeout_s: float = DEFAULT_QUERY_TIMEOUT_S,
) -> List[Dict[str, Any]]:
    """
    Chiama Qdrant /points/search.
    Ritorna la lista grezza di risultati (dict) da convertire in RetrievedChunk.
    """
    payload = {
        "vector": query_vector,
        "limit": int(top_k),
        "with_payload": bool(with_payload),
        # Filtri "hard" per non mischiare esami/versioni
        "filter": {
            "must": [
                {"key": "exam_id", "match": {"value": int(exam_id)}},
                {"key": "version", "match": {"value": int(version)}},
            ]
        },
    }

    try:
        r = await client.post(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points/search",
            json=payload,
            timeout=timeout_s,
        )
    except httpx.HTTPError as e:
        raise RAGRetrievalError(f"Errore chiamando Qdrant search: {e}") from e

    if r.status_code != 200:
        raise RAGRetrievalError(f"Qdrant search HTTP {r.status_code}: {r.text}")

    data = r.json()
    result = data.get("result")
    if not isinstance(result, list):
        raise RAGRetrievalError(
            "Risposta Qdrant non valida: campo 'result' non è una lista."
        )

    return result


def _parse_retrieved(result_item: Dict[str, Any]) -> Optional[RetrievedChunk]:
    """
    Converte un item del result Qdrant in RetrievedChunk.
    Esempio item Qdrant:
      {
        "id": "...",
        "score": 0.82,
        "payload": {...}
      }
    """
    if not isinstance(result_item, dict):
        return None

    score = result_item.get("score")
    payload = result_item.get("payload") or {}

    if not isinstance(score, (int, float)):
        return None
    if not isinstance(payload, dict):
        return None

    chunk_id = payload.get("chunk_id") or result_item.get("id")
    text = payload.get("text")
    source_ref = payload.get("source_ref", "")
    exam_id = payload.get("exam_id")
    material_id = payload.get("material_id")
    version = payload.get("version")
    page = payload.get("page")

    if not isinstance(chunk_id, str) or not chunk_id:
        return None
    if not isinstance(text, str) or not text.strip():
        return None
    if not isinstance(source_ref, str):
        source_ref = ""

    if (
        not isinstance(exam_id, int)
        or not isinstance(material_id, int)
        or not isinstance(version, int)
    ):
        # se payload non è quello atteso, scarta
        return None

    if page is not None and not isinstance(page, int):
        page = None

    return RetrievedChunk(
        chunk_id=chunk_id,
        text=text.strip(),
        source_ref=source_ref,
        score=float(score),
        exam_id=exam_id,
        material_id=material_id,
        version=version,
        page=page,
    )


# =========================
# Service
# =========================


class RAGService:
    """
    STEP 6 (MVP): Retrieval per similarità
    - embedding(query) con Ollama
    - search su Qdrant filtrando per exam_id + version
    - ritorna top_k chunks (testo + source_ref + score)
    """

    @staticmethod
    async def retrieve_context(
        *,
        exam_id: int,
        version: int,
        question: str,
        student_answer: str,
        top_k: int = DEFAULT_TOP_K,
        embed_model: Optional[str] = None,
    ) -> List[RetrievedChunk]:
        q = (question or "").strip()
        a = (student_answer or "").strip()

        # query semantica consigliata
        query_text = f"{q}\n{a}".strip()
        if not query_text:
            return []

        async with httpx.AsyncClient() as client:
            # 1) embedding query (Ollama)
            try:
                query_vec = await ollama_embed(
                    client,
                    text=query_text,
                    model=embed_model,
                )
            except MaterialIngestionError as e:
                # riuso lo stesso tipo di errore “infra”
                raise RAGRetrievalError(str(e)) from e

            # 2) search in Qdrant
            raw_results = await qdrant_search(
                client,
                query_vector=query_vec,
                exam_id=exam_id,
                version=version,
                top_k=top_k,
                with_payload=True,
            )

        # 3) parse + drop invalid
        out: List[RetrievedChunk] = []
        for item in raw_results:
            ch = _parse_retrieved(item)
            if ch is not None:
                out.append(ch)

        return out
