import logging
import time

from app.config.intelligence import intel_settings

logger = logging.getLogger(__name__)


def _get_openai_client():
    import openai

    if not intel_settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is required for embeddings")
    return openai.OpenAI(api_key=intel_settings.openai_api_key)


def _embed_batch_with_retry(texts: list[str], model: str, max_retries: int = 3) -> list[list[float]]:
    client = _get_openai_client()
    for attempt in range(max_retries):
        try:
            resp = client.embeddings.create(model=model, input=texts)
            return [item.embedding for item in sorted(resp.data, key=lambda x: x.index)]
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt * 2
            logger.warning("Embedding attempt %d failed: %s — retrying in %ds", attempt + 1, e, wait)
            time.sleep(wait)
    return []  # unreachable


def embed_texts(texts: list[str]) -> tuple[list[list[float]], int]:
    """Embed a list of texts. Returns (embeddings, total_tokens).

    Batches internally according to intel_settings.embedding_batch_size.
    Raises RuntimeError if the embedding provider is unavailable.
    """
    model = intel_settings.embedding_model
    batch_size = intel_settings.embedding_batch_size
    all_embeddings: list[list[float]] = []
    total_tokens = 0

    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        embeddings = _embed_batch_with_retry(batch, model)
        all_embeddings.extend(embeddings)
        # Approximate token count: ~1 token per 4 chars
        total_tokens += sum(len(t) // 4 for t in batch)
        logger.info("Embedded batch %d-%d/%d", i, i + len(batch), len(texts))

    return all_embeddings, total_tokens
