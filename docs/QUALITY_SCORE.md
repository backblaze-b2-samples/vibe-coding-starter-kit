# Quality Score Checklist

Use this checklist to evaluate code quality before merging. Target: all items checked.

## Code Quality

- [ ] No files exceed 300 lines
- [ ] No functions exceed 50 lines
- [ ] All public functions have type annotations
- [ ] No `# type: ignore` without explanation
- [ ] No bare `except:` clauses
- [ ] No `print()` statements (use structured logging)

## Architecture

- [ ] Layering rules respected (types -> config -> repo -> service -> runtime)
- [ ] No backward imports across layers
- [ ] No `boto3` outside `app/repo/`
- [ ] All boundary data validated with Pydantic models
- [ ] No shared mutable state across layers

## Testing

- [ ] New behavior has tests
- [ ] Structural tests pass (`pytest tests/test_structure.py`)
- [ ] Lint passes (`ruff check .`)
- [ ] Frontend lint passes (`pnpm lint`)
- [ ] Frontend builds (`pnpm build`)

## Documentation

- [ ] Feature docs updated for behavior changes
- [ ] ARCHITECTURE.md updated for boundary changes
- [ ] README.md updated for setup/scope changes

## Security

- [ ] No secrets in source code
- [ ] Input validation at all boundaries
- [ ] No new dependencies without justification
