from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).parents[4] / ".env"


class IntelligenceSettings(BaseSettings):
    github_repo: str = "backblaze-labs/demand-side-ai"
    github_token: str = ""

    llm_model: str = "claude-haiku-4-5-20251001"
    anthropic_api_key: str = ""

    snapshot_prefix: str = "intelligence"
    max_issues_per_run: int = 500
    cluster_min_size: int = 3
    top_n_issues: int = 5

    # Embeddings run locally (sentence-transformers) — no per-token cost
    embedding_cost_per_1k: float = 0.0
    llm_input_cost_per_1k: float = 0.001
    llm_output_cost_per_1k: float = 0.005

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8", "extra": "ignore"}


intel_settings = IntelligenceSettings()
