from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    b2_s3_endpoint: str = "https://s3.us-west-004.backblazeb2.com"
    b2_application_key_id: str = ""
    b2_application_key: str = ""
    b2_bucket_name: str = ""
    b2_public_url: str = ""

    api_port: int = 8000
    api_cors_origins: str = "http://localhost:3000"

    # Upload limits
    max_file_size: int = 100 * 1024 * 1024  # 100MB

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.api_cors_origins.split(",")]


settings = Settings()
