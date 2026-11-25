import logging

from app.config.intelligence import EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION

logger = logging.getLogger(__name__)

_model = None


def _get_model():
    global _model
    if _model is None:
        # Optional dependency (requirements-intelligence.txt): import lazily so
        # the API starts, and its tests run, without the ML stack installed.
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model %s@%s", EMBEDDING_MODEL, EMBEDDING_MODEL_REVISION)
        _model = SentenceTransformer(EMBEDDING_MODEL, revision=EMBEDDING_MODEL_REVISION)
    return _model


def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """Embed texts with the pinned local model. Returns (embeddings, approx_tokens)."""
    embeddings = _get_model().encode(texts, convert_to_numpy=True, show_progress_bar=False)
    approx_tokens = sum(len(t) // 4 for t in texts)
    logger.info("Embedded %d texts locally (model=%s)", len(texts), EMBEDDING_MODEL)
    return embeddings.tolist(), approx_tokens
