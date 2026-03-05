# app/services/rag_grading_service.py

import json
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from app.services.ai_service import evaluate_with_ollama
from app.services.vectors.rag_service import RAGService, RetrievedChunk


class RAGGradingError(Exception):
    pass


@dataclass
class RAGGradingOutput:
    ai_result: Dict[str, Any]
    used_chunks: List[RetrievedChunk]
    prompt: str  # utile per debug (puoi non salvarlo)


class RAGGradingService:
    """
    STEP 9+10 (MVP):
    - retrieval (Step 6) tramite RAGService
    - build prompt grounded (Step 9)
    - grading via Ollama (Step 10) tramite evaluate_with_ollama
    """

    @staticmethod
    def build_prompt_grounded(
        *,
        exam_title: str,
        exam_description: Optional[str],
        rubric: Any,
        qa_items: List[Dict[str, Any]],
        retrieved_chunks: List[RetrievedChunk],
    ) -> str:
        rubric_s = json.dumps(rubric, ensure_ascii=False, separators=(",", ":"))
        qa_s = json.dumps(qa_items, ensure_ascii=False, separators=(",", ":"))
        desc = (exam_description or "").strip()

        # blocco contesto con citazioni
        context_lines: List[str] = []
        for idx, ch in enumerate(retrieved_chunks, start=1):
            tag = f"S{idx}"
            src = ch.source_ref or ""
            meta = src
            if ch.page is not None:
                meta = f"{meta} (page={ch.page})" if meta else f"page={ch.page}"
            meta = f"{meta} | chunk_id={ch.chunk_id}".strip(" |")
            context_lines.append(f"[{tag}] {ch.text}\n(Fonte: {meta})")

        context_block = (
            "\n\n".join(context_lines) if context_lines else "(nessun contesto trovato)"
        )

        return f"""
Sei un docente universitario.

Valuta le risposte usando SOLO:
1) RUBRICA_JSON
2) CONTESTO (materiale del corso) fornito sotto.

Se il contesto NON contiene informazioni sufficienti per valutare correttamente:
- dichiaralo chiaramente nel comment
- non inventare dettagli
- assegna un punteggio prudente/coerente

TITOLO:
{exam_title}

DESCRIZIONE:
{desc}

RUBRICA_JSON:
{rubric_s}

RISPOSTE_JSON:
{qa_s}

CONTESTO:
{context_block}

REGOLE OUTPUT:
- score: intero 0..30
- honors: true solo se score=30
- comment: breve, chiaro, utile (se possibile cita [S1], [S2]...)
- details_json: null oppure breakdown (opzionale)

Rispondi SOLO con JSON valido nel formato:
{{"score":0,"honors":false,"comment":"","details_json":null}}

Nessun testo fuori dal JSON.
""".strip()

    @staticmethod
    async def grade_submission_grounded(
        *,
        exam_id: int,
        materials_version: int,
        exam_title: str,
        exam_description: Optional[str],
        rubric: Any,
        qa_items: List[Dict[str, Any]],
        model: Optional[str] = None,
        embed_model: Optional[str] = None,
        top_k: int = 8,
        num_predict: int = 512,
        keep_alive: str = "10m",
        schema_format: Any = None,
    ) -> RAGGradingOutput:
        """
        MVP: retrieval a livello di submission (non per domanda)
        """
        # Costruisci query unica per retrieval
        query_blob = "\n\n".join(
            [f"Q: {x.get('q','')}\nA: {x.get('a','')}" for x in qa_items]
        ).strip()
        if not query_blob:
            raise RAGGradingError("Empty QA items - cannot build retrieval query.")

        retrieved = await RAGService.retrieve_context(
            exam_id=exam_id,
            version=materials_version,
            question="Domande dell'esame",
            student_answer=query_blob,
            top_k=top_k,
            embed_model=embed_model,
        )

        prompt = RAGGradingService.build_prompt_grounded(
            exam_title=exam_title,
            exam_description=exam_description,
            rubric=rubric,
            qa_items=qa_items,
            retrieved_chunks=retrieved,
        )

        ai_result = await evaluate_with_ollama(
            model=model,
            prompt=prompt,
            schema_format=schema_format,
            num_predict=num_predict,
            keep_alive=keep_alive,
        )

        return RAGGradingOutput(
            ai_result=ai_result,
            used_chunks=retrieved,
            prompt=prompt,
        )
