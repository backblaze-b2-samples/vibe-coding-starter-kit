from pydantic_settings import BaseSettings


class IntelligenceSettings(BaseSettings):
    github_repo: str = "backblaze-labs/demand-side-ai"
    github_token: str = ""

    embedding_model: str = "text-embedding-3-small"
    embedding_batch_size: int = 32
    llm_model: str = "claude-3-5-haiku-20241022"

    openai_api_key: str = ""
    anthropic_api_key: str = ""

    snapshot_prefix: str = "intelligence"
    max_issues_per_run: int = 500
    cluster_min_size: int = 3
    top_n_issues: int = 5

    # Per-1k-token cost (USD) for cost logging — update if model pricing changes
    embedding_cost_per_1k: float = 0.00002
    llm_input_cost_per_1k: float = 0.001
    llm_output_cost_per_1k: float = 0.005

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


intel_settings = IntelligenceSettings()
