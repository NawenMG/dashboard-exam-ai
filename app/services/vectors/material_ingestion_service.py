# app/services/material_ingestion_service.py

import os
import re
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import httpx

# =========================
# Config
# =========================

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434").rstrip("/")
OLLAMA_EMBEDDINGS_PATH = os.getenv("OLLAMA_EMBEDDINGS_PATH", "/api/embeddings")
OLLAMA_EMBEDDINGS_URL = f"{OLLAMA_BASE_URL}{OLLAMA_EMBEDDINGS_PATH}"

DEFAULT_OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333").rstrip("/")
QDRANT_COLLECTION = os.getenv("QDRANT_COLLECTION", "exam_material_chunks")

# Chunking (MVP): basato su parole (semplice e robusto senza tokenizer)
DEFAULT_CHUNK_WORDS = int(os.getenv("RAG_CHUNK_WORDS", "220"))
DEFAULT_CHUNK_OVERLAP_WORDS = int(os.getenv("RAG_CHUNK_OVERLAP", "40"))

# (facoltativo) per evitare payload troppo grandi in Qdrant
# Qdrant regge payload grandi, ma è meglio tenere il testo in dimensioni ragionevoli.
MAX_PAYLOAD_TEXT_CHARS = int(os.getenv("RAG_MAX_PAYLOAD_TEXT_CHARS", "20000"))


# =========================
# Errors
# =========================


class MaterialIngestionError(Exception):
    pass


# =========================
# Data
# =========================


@dataclass
class TextChunk:
    chunk_id: str
    text: str
    source_ref: str  # es: "file.pdf#p=12&c=0" oppure "text#c=0"
    exam_id: int
    material_id: int
    version: int
    page: Optional[int] = None


# =========================
# Helpers
# =========================


def _clean_text(s: str) -> str:
    s = s.replace("\x00", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def chunk_text_words(text: str, *, chunk_words: int, overlap_words: int) -> List[str]:
    """
    Chunking semplice (MVP) basato su parole.
    - chunk_words: dimensione finestra
    - overlap_words: sovrapposizione
    """
    text = _clean_text(text)
    if not text:
        return []

    words = text.split()
    if len(words) <= chunk_words:
        return [text]

    chunks: List[str] = []
    step = max(1, chunk_words - overlap_words)

    for start in range(0, len(words), step):
        end = min(len(words), start + chunk_words)
        piece = " ".join(words[start:end]).strip()
        if piece:
            chunks.append(piece)
        if end >= len(words):
            break

    return chunks


def extract_text_from_pdf_pages(file_path: str) -> List[Tuple[int, str]]:
    """
    Estrae testo per pagina da PDF.
    Ritorna: [(page_number_1_based, text), ...]

    Dipendenza: pypdf (pip install pypdf)
    """
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception as e:
        raise MaterialIngestionError(
            "Per estrarre PDF installa 'pypdf' (pip install pypdf) "
            "oppure usa ingestion da testo."
        ) from e

    try:
        reader = PdfReader(file_path)
    except Exception as e:
        raise MaterialIngestionError(f"Impossibile leggere PDF: {file_path}") from e

    out: List[Tuple[int, str]] = []
    for idx, page in enumerate(reader.pages):
        page_no = idx + 1
        try:
            txt = page.extract_text() or ""
        except Exception:
            txt = ""
        txt = _clean_text(txt)
        if txt:
            out.append((page_no, txt))
    return out


def _safe_payload_text(text: str) -> str:
    if not isinstance(text, str):
        return ""
    text = text.strip()
    if len(text) <= MAX_PAYLOAD_TEXT_CHARS:
        return text
    return text[:MAX_PAYLOAD_TEXT_CHARS]


# =========================
# External calls
# =========================


async def ollama_embed(
    client: httpx.AsyncClient,
    *,
    text: str,
    model: Optional[str] = None,
    timeout_s: float = 60.0,
) -> List[float]:
    use_model = model or DEFAULT_OLLAMA_EMBED_MODEL
    try:
        r = await client.post(
            OLLAMA_EMBEDDINGS_URL,
            json={"model": use_model, "prompt": text},
            timeout=timeout_s,
        )
    except httpx.HTTPError as e:
        raise MaterialIngestionError(f"Errore chiamando Ollama embeddings: {e}") from e

    if r.status_code != 200:
        raise MaterialIngestionError(
            f"Ollama embeddings HTTP {r.status_code}: {r.text}"
        )

    data = r.json()
    emb = data.get("embedding")
    if (
        not isinstance(emb, list)
        or not emb
        or not all(isinstance(x, (int, float)) for x in emb)
    ):
        raise MaterialIngestionError(
            "Risposta embeddings non valida da Ollama (campo 'embedding')."
        )

    return [float(x) for x in emb]


async def qdrant_get_collection(
    client: httpx.AsyncClient, *, collection_name: str
) -> Optional[Dict[str, Any]]:
    r = await client.get(f"{QDRANT_URL}/collections/{collection_name}")
    if r.status_code == 404:
        return None
    if r.status_code != 200:
        raise MaterialIngestionError(
            f"Qdrant get collection HTTP {r.status_code}: {r.text}"
        )
    return r.json()


async def qdrant_create_collection(
    client: httpx.AsyncClient,
    *,
    collection_name: str,
    vector_size: int,
    distance: str = "Cosine",
) -> None:
    payload = {"vectors": {"size": int(vector_size), "distance": distance}}
    r = await client.put(f"{QDRANT_URL}/collections/{collection_name}", json=payload)
    if r.status_code not in (200, 201):
        raise MaterialIngestionError(
            f"Qdrant create collection HTTP {r.status_code}: {r.text}"
        )


async def qdrant_upsert_points(
    client: httpx.AsyncClient,
    *,
    collection_name: str,
    points: List[Dict[str, Any]],
) -> None:
    r = await client.put(
        f"{QDRANT_URL}/collections/{collection_name}/points?wait=true",
        json={"points": points},
    )
    if r.status_code != 200:
        raise MaterialIngestionError(f"Qdrant upsert HTTP {r.status_code}: {r.text}")


async def qdrant_ensure_payload_indexes(
    client: httpx.AsyncClient, *, collection_name: str
) -> None:
    """
    Per la soluzione consigliata (1 collection + filter):
    creiamo indici payload su exam_id e material_id per velocizzare i filtri.
    È safe chiamarlo più volte (se l'indice esiste, Qdrant risponde ok o errore "already exists"
    a seconda della versione; gestiamo in modo tollerante).
    """
    indexes = [
        ("exam_id", {"type": "integer"}),
        ("material_id", {"type": "integer"}),
        ("version", {"type": "integer"}),
    ]

    for field_name, field_schema in indexes:
        r = await client.put(
            f"{QDRANT_URL}/collections/{collection_name}/index",
            json={"field_name": field_name, "field_schema": field_schema},
        )
        # accettiamo 200/201; se alcune versioni danno 409 su "already exists" tolleriamo
        if r.status_code in (200, 201, 409):
            continue
        # se la collection non supporta l'endpoint (vecchie versioni) non blocchiamo l'ingestione
        if r.status_code == 404:
            return
        raise MaterialIngestionError(
            f"Qdrant create payload index failed HTTP {r.status_code}: {r.text}"
        )


# =========================
# Service
# =========================


class MaterialIngestionService:
    """
    MVP: ingestione materiale (testo o PDF) → chunk → embedding (Ollama) → Qdrant upsert

    ✅ Strategia consigliata:
    - UNA sola collection (QDRANT_COLLECTION)
    - ogni chunk ha payload con exam_id/material_id/version
    - in retrieval userai un filtro su exam_id (e opzionalmente material_id/version)
    """

    @staticmethod
    async def ingest_text(
        *,
        exam_id: int,
        material_id: int,
        version: int,
        text: str,
        source_ref: str = "text",
        embed_model: Optional[str] = None,
        chunk_words: int = DEFAULT_CHUNK_WORDS,
        overlap_words: int = DEFAULT_CHUNK_OVERLAP_WORDS,
    ) -> List[TextChunk]:
        if not text or not text.strip():
            return []

        pieces = chunk_text_words(
            text, chunk_words=chunk_words, overlap_words=overlap_words
        )
        chunks: List[TextChunk] = []
        for idx, piece in enumerate(pieces):
            chunks.append(
                TextChunk(
                    chunk_id=str(uuid.uuid4()),
                    text=piece,
                    source_ref=f"{source_ref}#c={idx}",
                    exam_id=exam_id,
                    material_id=material_id,
                    version=version,
                )
            )

        await MaterialIngestionService._embed_and_upsert(
            chunks, embed_model=embed_model
        )
        return chunks

    @staticmethod
    async def ingest_pdf(
        *,
        exam_id: int,
        material_id: int,
        version: int,
        file_path: str,
        embed_model: Optional[str] = None,
        chunk_words: int = DEFAULT_CHUNK_WORDS,
        overlap_words: int = DEFAULT_CHUNK_OVERLAP_WORDS,
    ) -> List[TextChunk]:
        pages = extract_text_from_pdf_pages(file_path)
        if not pages:
            return []

        all_chunks: List[TextChunk] = []
        base = os.path.basename(file_path)

        for page_no, page_text in pages:
            pieces = chunk_text_words(
                page_text, chunk_words=chunk_words, overlap_words=overlap_words
            )
            for idx, piece in enumerate(pieces):
                all_chunks.append(
                    TextChunk(
                        chunk_id=str(uuid.uuid4()),
                        text=piece,
                        source_ref=f"{base}#p={page_no}&c={idx}",
                        exam_id=exam_id,
                        material_id=material_id,
                        version=version,
                        page=page_no,
                    )
                )

        await MaterialIngestionService._embed_and_upsert(
            all_chunks, embed_model=embed_model
        )
        return all_chunks

    @staticmethod
    async def _embed_and_upsert(
        chunks: List[TextChunk], *, embed_model: Optional[str]
    ) -> None:
        if not chunks:
            return

        collection_name = QDRANT_COLLECTION

        async with httpx.AsyncClient() as client:
            # 1) embedding del primo chunk per determinare vector size
            first_vec = await ollama_embed(
                client, text=chunks[0].text, model=embed_model
            )
            vector_size = len(first_vec)

            # 2) ensure collection (UNA sola)
            coll = await qdrant_get_collection(client, collection_name=collection_name)
            if coll is None:
                await qdrant_create_collection(
                    client,
                    collection_name=collection_name,
                    vector_size=vector_size,
                    distance="Cosine",
                )
                # indici payload per filtri (best effort)
                await qdrant_ensure_payload_indexes(
                    client, collection_name=collection_name
                )
            else:
                # best effort: proviamo a creare indici comunque
                try:
                    await qdrant_ensure_payload_indexes(
                        client, collection_name=collection_name
                    )
                except Exception:
                    pass

            # 3) embed + upsert
            points: List[Dict[str, Any]] = []

            def payload_for(ch: TextChunk) -> Dict[str, Any]:
                return {
                    "exam_id": int(ch.exam_id),
                    "material_id": int(ch.material_id),
                    "version": int(ch.version),
                    "chunk_id": ch.chunk_id,
                    "text": _safe_payload_text(ch.text),
                    "source_ref": ch.source_ref,
                    "page": ch.page,
                }

            # primo
            points.append(
                {
                    "id": chunks[0].chunk_id,
                    "vector": first_vec,
                    "payload": payload_for(chunks[0]),
                }
            )

            # resto (seriale MVP; se vuoi poi ottimizziamo in batch)
            for ch in chunks[1:]:
                vec = await ollama_embed(client, text=ch.text, model=embed_model)
                points.append(
                    {
                        "id": ch.chunk_id,
                        "vector": vec,
                        "payload": payload_for(ch),
                    }
                )

            await qdrant_upsert_points(
                client, collection_name=collection_name, points=points
            )
