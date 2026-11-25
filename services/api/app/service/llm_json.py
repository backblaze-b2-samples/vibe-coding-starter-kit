def extract_json(raw: str) -> str:
    """The outermost JSON object in an LLM reply, without any markdown fencing."""
    start = raw.find("{")
    end = raw.rfind("}")
    if start != -1 and end != -1:
        return raw[start : end + 1]
    return raw
