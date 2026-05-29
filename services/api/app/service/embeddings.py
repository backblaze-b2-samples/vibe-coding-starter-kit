import logging

from app.config.intelligence import intel_settings
from app.repo.embedding_client import embed_texts
from app.repo.intelligence_storage import read_embeddings, read_raw_snapshot, write_embeddings

logger = logging.getLogger(__name__)


def run_embeddings(snapshot_id: str) -> dict:
    """Embed all issues in a raw snapshot, caching by content_hash.

    Returns cost metadata: {embedding_tokens, reused_embeddings, new_embeddings}.
    """
    issues, _ = read_raw_snapshot(snapshot_id)
    existing = {r["content_hash"]: r["embedding"] for r in read_embeddings(snapshot_id)}

    new_issues = [i for i in issues if i.content_hash not in existing]
    reused = len(issues) - len(new_issues)

    new_embeddings: list[list[float]] = []
    embedding_tokens = 0

    if new_issues:
        texts = [f"{i.title}\n\n{i.body or ''}" for i in new_issues]
        new_embeddings, embedding_tokens = embed_texts(texts)

    records = []
    new_iter = iter(new_embeddings)
    for issue in issues:
        emb = existing[issue.content_hash] if issue.content_hash in existing else next(new_iter)
        records.append({
            "issue_id": issue.id,
            "embedding": emb,
            "model_id": "all-MiniLM-L6-v2",
            "content_hash": issue.content_hash,
        })

    write_embeddings(snapshot_id, records)

    cost = embedding_tokens * intel_settings.embedding_cost_per_1k / 1000
    logger.info(
        "Embeddings complete snapshot=%s new=%d reused_embeddings=%d tokens=%d cost_usd=%.4f",
        snapshot_id, len(new_issues), reused, embedding_tokens, cost,
    )
    return {
        "embedding_tokens": embedding_tokens,
        "reused_embeddings": reused,
        "new_embeddings": len(new_issues),
        "embedding_cost_usd": round(cost, 6),
    }
