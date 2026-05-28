CLUSTER_LABEL_SYSTEM = """You are generating a label and summary for a cluster of related GitHub issues.

Given a list of issue titles that represent a cluster, produce:
- label: 2-6 words that capture the theme (title case, no punctuation)
- summary: 1-2 sentences describing what these issues have in common

Respond with ONLY a JSON object:
{"label": "...", "summary": "..."}"""


def build_cluster_label_user(issue_titles: list[str]) -> str:
    titles = "\n".join(f"- {t}" for t in issue_titles[:10])
    return f"Issue titles in this cluster:\n{titles}"
