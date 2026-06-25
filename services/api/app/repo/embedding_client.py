import logging

logger = logging.getLogger(__name__)

_MODEL_NAME = "all-MiniLM-L6-v2"
_model = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        logger.info("Loading embedding model %s (first run downloads ~90MB)", _MODEL_NAME)
        _model = SentenceTransformer(_MODEL_NAME)
    return _model


def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """Embed a list of texts using a local sentence-transformers model.

    Returns (embeddings, approx_token_count). Runs locally — no API key needed.
    """
    model = _get_model()
    embeddings = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    # Approximate token count for cost logging (local = $0 in API fees)
    approx_tokens = sum(len(t) // 4 for t in texts)
    logger.info("Embedded %d texts locally (model=%s)", len(texts), _MODEL_NAME)
    return embeddings.tolist(), approx_tokens
