# Golden Principles

Architectural invariants for this project. All code — human or agent — must follow these.

## 1. External APIs are wrapped in repository adapters

All external service calls (B2 S3, future databases, third-party APIs) live in `app/repo/`. No other layer imports `boto3`, HTTP clients, or SDK packages directly.

## 2. Boundary data is validated explicitly

Data crossing a trust boundary (HTTP request, external API response, file content) must be validated with Pydantic models or explicit checks. No raw dicts passed between layers.

## 3. No implicit type assumptions

Function signatures declare their types. No `**kwargs` forwarding across layer boundaries. Use typed Pydantic models or dataclasses.

## 4. No shared mutable state across layers

No module-level mutable globals shared between layers. Configuration is read-only after init. Clients are created per-request or via dependency injection.

## 5. Prefer boring, composable libraries

Choose well-maintained, single-purpose libraries over frameworks that impose structure. stdlib > small lib > large framework.

## 6. Layering flows one direction

`types` -> `config` -> `repo` -> `service` -> `runtime`. No backward imports. Runtime never imports from repo directly.

## 7. Files stay small

No single file exceeds 300 lines. If it does, split by responsibility. This keeps agent context windows effective and diffs reviewable.

## 8. Tests enforce structure

Structural tests verify layering rules, import boundaries, and file size limits mechanically. These run in CI alongside unit tests.
