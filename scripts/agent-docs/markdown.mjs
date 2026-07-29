/** Shared fence-aware Markdown parsing for `pnpm check:agent-docs`. */

/**
 * Prose headings in document order. Lines inside a fenced code block are never
 * headings: a `# comment` in a shell example used to be read as one, truncating
 * the section body above it.
 */
export function headings(markdown) {
  const found = [];
  let fence = null;

  markdown.split(/\r?\n/).forEach((line, index) => {
    const mark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1][0] ?? null;

    if (mark) {
      // A fence only closes with the character that opened it.
      fence = fence === mark ? null : (fence ?? mark);
      return;
    }

    const heading = fence === null ? /^(#{1,6})\s+(.*)$/.exec(line) : null;
    const text = heading ? heading[2].trim() : "";

    if (heading) {
      found.push({ index, level: heading[1].length, text, anchor: anchorOf(text) });
    }
  });

  return found;
}

/** GitHub heading anchor: `## 12. Secret Handling` -> `12-secret-handling`. */
export function anchorOf(headingText) {
  return headingText
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Body of the first `##`..`####` heading matching `headingPattern`. Matched by
 * heading text, not section number: numbering churns, the rule must not.
 */
export function sectionBody(markdown, headingPattern) {
  const lines = markdown.split(/\r?\n/);
  const all = headings(markdown);
  const at = all.findIndex(
    ({ level, text }) => level >= 2 && level <= 4 && headingPattern.test(text),
  );

  if (at === -1) {
    return null;
  }

  const next = all.slice(at + 1).find((heading) => heading.level <= 4);

  return lines
    .slice(all[at].index + 1, next ? next.index : lines.length)
    .join("\n");
}
