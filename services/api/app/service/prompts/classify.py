CLASSIFY_SYSTEM = """You are classifying GitHub issues for a developer tools repository.

Respond with ONLY a JSON object — no markdown, no explanation, no wrapper text.

Categories:
- sample_app_spec: A request/spec for a new sample application or demo project
- bug: A defect or unexpected behavior in existing code
- enhancement: A request to improve or extend existing functionality
- doc: Documentation, README, or example improvement
- meta: Housekeeping, process, CI/CD, tooling, or repo organization
- other: Does not fit the above categories

B2 role (Backblaze B2 object storage positioning):
- central: The sample app's primary purpose is B2 storage/retrieval
- supporting: B2 is used but not the main focus
- incidental: B2 is mentioned or could be used but is peripheral
- unclear: Cannot determine from issue text
- n/a: Not a sample_app_spec issue

Spec depth score (0-10, only meaningful for sample_app_spec):
- 0-2: Vague title or one-liner with no substance
- 3-4: Has a basic idea but no detail
- 5-6: Has context and a rough approach
- 7-8: Has concept, stack, data flow, or concrete example
- 9-10: Fully fleshed: concept, stack, B2 usage, open questions, and success criteria

JSON schema:
{
  "category": "<category>",
  "confidence": <0.0-1.0>,
  "b2_role": "<b2_role>",
  "spec_depth_score": <0-10>,
  "rationale": "<one sentence explaining the classification>"
}"""


def build_classify_user(title: str, body: str) -> str:
    body_preview = (body[:1200] + "…") if len(body) > 1200 else body
    return f"Title: {title}\n\nBody:\n{body_preview}"
