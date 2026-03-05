Perfetto, ti faccio un riassunto **architetturale chiaro** di cosa fanno i tre service nel tuo sistema RAG.

---

# 🧠 1️⃣ `MaterialIngestionService`

📂 *Ingestione materiali (PDF → embedding → Qdrant)*

## Cosa fa

Quando carichi un PDF:

1. Estrae il testo (pagina per pagina)
2. Lo divide in chunk
3. Calcola gli embedding con Ollama
4. Salva i chunk vettoriali in **Qdrant**

   * nella collection unica `exam_material_chunks`
   * con payload:

     * `exam_id`
     * `material_id`
     * `version`
     * `text`
     * `page`
     * `chunk_id`

## È la fase:

> “Costruisco la base di conoscenza vettoriale dell’esame”

---

# 🔎 2️⃣ `RAGService`

📚 *Retrieval per similarità*

Quando uno studente invia una submission:

1. Prende domanda + risposta
2. Calcola embedding della query
3. Fa search in Qdrant
4. Filtra **SOLO** per:

   * `exam_id`
   * `version`
5. Ritorna i chunk più rilevanti

Restituisce oggetti:

```python
RetrievedChunk(
    chunk_id,
    text,
    source_ref,
    score,
    exam_id,
    material_id,
    version,
    page
)
```

## È la fase:

> “Dammi i pezzi di materiale più simili a questa risposta”

---

# 🎓 3️⃣ `RAGGradingService`

🧾 *Valutazione AI grounded*

Questo è il livello sopra.

Fa:

1. Chiama `RAGService` → ottiene i chunk rilevanti
2. Costruisce un prompt strutturato con:

   * titolo esame
   * descrizione
   * rubric JSON
   * risposte studente
   * contesto recuperato
3. Invia il prompt a Ollama
4. Riceve un JSON con:

   * score
   * honors
   * comment
   * details_json

## È la fase:

> “Valuta la submission usando SOLO rubric + materiale ufficiale”

---

# 🔁 Flusso completo

```
UPLOAD PDF
   ↓
MaterialIngestionService
   ↓
Qdrant (vector DB)

STUDENTE INVIA SUBMISSION
   ↓
RAGService (retrieval)
   ↓
Chunk rilevanti

   ↓
RAGGradingService
   ↓
Ollama grading
   ↓
Risultato strutturato JSON
```

---

# 🏗 Architettura concettuale

| Service                  | Tipo            | Ruolo                             |
| ------------------------ | --------------- | --------------------------------- |
| MaterialIngestionService | Storage builder | Costruisce il database vettoriale |
| RAGService               | Retrieval layer | Trova contesto rilevante          |
| RAGGradingService        | Reasoning layer | Valuta usando contesto            |

---

# 🎯 Perché è una buona architettura

* Separazione chiara tra:

  * ingestion
  * retrieval
  * reasoning
* Scalabile
* Testabile per parti
* Facilmente migliorabile (reranking, multi-query, ecc.)

---

Se vuoi nel prossimo messaggio ti faccio anche:

* 🧠 schema architetturale professionale
* oppure 🧪 come migliorare il retrieval (per domanda invece che per submission intera)
* oppure 🚀 come rendere il grading più robusto e meno “hallucination-prone”

Dimmi che direzione vuoi prendere.
