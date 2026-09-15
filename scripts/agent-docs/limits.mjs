/**
 * Size budget for AGENTS.md, declared once.
 *
 * `scripts/check-agent-docs.mjs` enforces it and `scripts/gen-docs.mjs`
 * refuses to write a file that would break it, so the generator cannot
 * green-light a document the next gate rejects. Two copies of these numbers
 * would be exactly the kind of "keep in sync" pair this repo removes
 * elsewhere, hence one module both import.
 *
 * Why 258 and not 250: the original budget was 250 lines of *content*, chosen
 * so the file stays readable in one pass. Four generated regions now cost 8
 * lines of `gen:begin` / `gen:end` marker comments, which a reader skips
 * entirely. Counting structural markers against a readability budget measures
 * the wrong thing, so the cap is the original 250 plus exactly that overhead.
 * Raise it again only for the same reason — a new generated region — and never
 * to make room for more prose.
 */
export const AGENT_DOC_LIMITS = {
  path: "AGENTS.md",
  minBytes: 1_000,
  maxBytes: 20_000,
  contentLines: 250,
  markerLines: 8,
  maxLines: 258,
};
