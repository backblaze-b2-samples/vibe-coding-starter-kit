from pathlib import Path

from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parents[4] / ".env"

# The default and only pre-approved target: this sample's own public repository.
DEFAULT_REPO = "backblaze-b2-samples/vibe-coding-starter-kit"

# Embeddings run locally (sentence-transformers), so there is no per-token
# fee. The model is pinned to a published revision: the same name can otherwise
# resolve to different weights later, and vectors from two revisions must not
# be mixed in one clustering run.
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
EMBEDDING_MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"


class IntelligenceSettings(BaseSettings):
    github_repo: str = DEFAULT_REPO
    # Comma-separated owner/name values the pipeline may read. Anything else is
    # refused, whoever asks: the pipeline spends GitHub quota and LLM tokens.
    github_allowed_repos: str = DEFAULT_REPO
    github_token: str = ""

    llm_model: str = "claude-haiku-4-5-20251001"
    anthropic_api_key: str = ""

    # The trigger routes (POST) are off unless explicitly enabled, and then need
    # `Authorization: Bearer <INTELLIGENCE_ADMIN_TOKEN>`. Reads stay public like
    # the rest of this API.
    intelligence_enabled: bool = False
    intelligence_admin_token: str = ""

    snapshot_prefix: str = "intelligence"
    # Hard cap on issues read (and so on LLM calls) per run.
    max_issues_per_run: int = 200
    cluster_min_size: int = 3
    top_n_issues: int = 5

    embedding_cost_per_1k: float = 0.0
    llm_input_cost_per_1k: float = 0.001
    llm_output_cost_per_1k: float = 0.005

    model_config = {"env_file": str(_ENV_FILE), "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def allowed_repos(self) -> frozenset[str]:
        return frozenset(r.strip() for r in self.github_allowed_repos.split(",") if r.strip())


intel_settings = IntelligenceSettings()
