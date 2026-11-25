import logging
import time

from app.config.intelligence import intel_settings

logger = logging.getLogger(__name__)


def _get_anthropic_client():
    import anthropic

    if not intel_settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is required for LLM operations")
    return anthropic.Anthropic(api_key=intel_settings.anthropic_api_key)


def call_llm(
    system: str, user: str, max_tokens: int = 512, max_retries: int = 3
) -> tuple[str, int, int]:
    """Send a system+user prompt to Claude. Returns (response_text, input_tokens, output_tokens).

    Retries with exponential backoff on transient errors.
    """
    client = _get_anthropic_client()
    for attempt in range(max_retries):
        try:
            msg = client.messages.create(
                model=intel_settings.llm_model,
                max_tokens=max_tokens,
                system=system,
                messages=[{"role": "user", "content": user}],
            )
            text = msg.content[0].text if msg.content else ""
            return text, msg.usage.input_tokens, msg.usage.output_tokens
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            wait = 2 ** attempt * 2
            logger.warning("LLM attempt %d failed: %s — retrying in %ds", attempt + 1, e, wait)
            time.sleep(wait)
    return "", 0, 0  # unreachable
