import json
import logging

import numpy as np

from app.config.intelligence import intel_settings
from app.repo.intelligence_storage import read_embeddings, read_raw_snapshot, write_clusters
from app.repo.llm_client import call_llm
from app.service.prompts.cluster_label import CLUSTER_LABEL_SYSTEM, build_cluster_label_user
from app.types.cluster import Cluster, ClusterAssignment

logger = logging.getLogger(__name__)

_UNCLUSTERED_ID = "unclustered"


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    return float(np.dot(a, b) / denom) if denom > 0 else 0.0


def _run_hdbscan(matrix: np.ndarray, min_cluster_size: int) -> np.ndarray:
    from sklearn.cluster import HDBSCAN

    clusterer = HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean")
    return clusterer.fit_predict(matrix)


def _find_centroid_issues(
    issue_ids: list[int], id_to_emb: dict[int, np.ndarray], top_n: int = 5
) -> list[int]:
    embeddings = np.array([id_to_emb[i] for i in issue_ids if i in id_to_emb])
    if len(embeddings) == 0:
        return issue_ids[:top_n]
    centroid = embeddings.mean(axis=0)
    sims = [(iid, _cosine_similarity(id_to_emb[iid], centroid)) for iid in issue_ids if iid in id_to_emb]
    sims.sort(key=lambda x: x[1], reverse=True)
    return [iid for iid, _ in sims[:top_n]]


def _generate_label(issue_titles: list[str]) -> tuple[str, str, int, int]:
    user_msg = build_cluster_label_user(issue_titles)
    raw, inp, out = call_llm(CLUSTER_LABEL_SYSTEM, user_msg)
    try:
        data = json.loads(raw)
        return data["label"], data["summary"], inp, out
    except (json.JSONDecodeError, KeyError):
        return "Uncategorized", "Issues that share a common theme.", inp, out


def run_clustering(snapshot_id: str) -> dict:
    """Cluster issues from snapshot_id using HDBSCAN + LLM labeling.

    Returns cost metadata: {cluster_count, unclustered_count, llm_input_tokens, ...}.
    """
    issues, _ = read_raw_snapshot(snapshot_id)
    emb_records = read_embeddings(snapshot_id)

    if not emb_records:
        raise RuntimeError(f"No embeddings found for snapshot {snapshot_id}. Run embeddings stage first.")

    id_to_hash = {i.id: i.content_hash for i in issues}
    hash_to_emb = {r["content_hash"]: np.array(r["embedding"], dtype=np.float32) for r in emb_records}
    issue_ids_ordered = [i.id for i in issues if id_to_hash.get(i.id) in hash_to_emb]
    matrix = np.array([hash_to_emb[id_to_hash[iid]] for iid in issue_ids_ordered])
    id_to_emb = {iid: hash_to_emb[id_to_hash[iid]] for iid in issue_ids_ordered}

    labels = _run_hdbscan(matrix, intel_settings.cluster_min_size)

    cluster_to_ids: dict[int, list[int]] = {}
    for idx, label in enumerate(labels):
        cluster_to_ids.setdefault(int(label), []).append(issue_ids_ordered[idx])

    id_to_title = {i.id: i.title for i in issues}
    clusters: list[Cluster] = []
    assignments: list[ClusterAssignment] = []
    total_input = total_output = 0

    for label_int, iids in sorted(cluster_to_ids.items()):
        if label_int == -1:
            cluster_id = _UNCLUSTERED_ID
            cluster_label = "Unclustered"
            summary = "Issues that did not form a strong enough cluster."
        else:
            cluster_id = f"c{label_int}"
            centroid_ids = _find_centroid_issues(iids, id_to_emb)
            rep_titles = [id_to_title[i] for i in centroid_ids if i in id_to_title]
            cluster_label, summary, inp, out = _generate_label(rep_titles)
            total_input += inp
            total_output += out

        centroid_list = _find_centroid_issues(iids, id_to_emb, top_n=1)
        clusters.append(Cluster(
            cluster_id=cluster_id,
            label=cluster_label,
            summary=summary,
            issue_ids=iids,
            size=len(iids),
            centroid_id=centroid_list[0] if centroid_list else None,
        ))
        for iid in iids:
            assignments.append(ClusterAssignment(issue_id=iid, cluster_id=cluster_id))

    write_clusters(snapshot_id, clusters, assignments)

    cost = (
        total_input * intel_settings.llm_input_cost_per_1k / 1000
        + total_output * intel_settings.llm_output_cost_per_1k / 1000
    )
    logger.info("Clustering complete snapshot=%s clusters=%d cost_usd=%.4f", snapshot_id, len(clusters), cost)
    return {
        "cluster_count": len([c for c in clusters if c.cluster_id != _UNCLUSTERED_ID]),
        "unclustered_count": len(cluster_to_ids.get(-1, [])),
        "llm_input_tokens": total_input,
        "llm_output_tokens": total_output,
        "llm_cluster_cost_usd": round(cost, 6),
    }
