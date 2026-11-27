import re


def neutralize(text: str, tag: str) -> str:
    """Remove any `<tag>` / `</tag>` from untrusted text so it cannot close or
    reopen the delimiter the prompt wraps it in."""
    return re.sub(rf"<\s*/?\s*{re.escape(tag)}\s*>", "[removed]", text, flags=re.IGNORECASE)
