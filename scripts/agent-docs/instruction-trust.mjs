/** Instruction-trust boundary coverage for `pnpm check:agent-docs`. */

function sectionBody(markdown) {
  const lines = markdown.split(/\r?\n/);
  let fence = null;
  let start = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fenceMark = /^\s{0,3}(`{3,}|~{3,})/.exec(line)?.[1][0] ?? null;

    if (fenceMark) {
      fence = fence === fenceMark ? null : (fence ?? fenceMark);
      continue;
    }

    if (fence !== null) {
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);

    if (!heading) {
      continue;
    }

    if (start === null && heading[1].length === 2 && /instruction authority/i.test(heading[2])) {
      start = index + 1;
      continue;
    }

    if (start !== null && heading[1].length <= 2) {
      return lines.slice(start, index).join("\n");
    }
  }

  return start === null ? null : lines.slice(start).join("\n");
}

function sentenceWith(body, tests) {
  return body
    .split(/\r?\n|(?<=[.!?])\s+/)
    .some((sentence) => tests.every((test) => test.test(sentence)));
}

export function checkInstructionTrustBoundary(markdown) {
  const passes = [];
  const failures = [];
  const boundary = sectionBody(markdown);
  const record = (ok, message, detail) => {
    if (ok) {
      passes.push(message);
    } else {
      failures.push(`${message} — ${detail}`);
    }
  };

  record(
    boundary !== null,
    'AGENTS.md has an "Instruction Authority" section',
    'expected a level-two heading containing "Instruction Authority", found none',
  );

  if (boundary === null) {
    return { passes, failures };
  }

  record(
    sentenceWith(boundary, [/user(?:'s)? request/i, /trusted repository instructions/i, /authoritative/i]),
    'AGENTS.md makes the user request and trusted repository instructions authoritative',
    'expected one statement in the Instruction Authority section to name the user request, trusted repository instructions, and authority',
  );

  const untrusted = [/untrusted data/i, /issues/i, /comments/i, /fixtures/i, /generated docs/i, /html/i, /accessibility/i, /third-party/i, /user explicitly adopt/i];

  record(
    sentenceWith(boundary, untrusted),
    'AGENTS.md treats embedded instructions in untrusted content as data unless the user explicitly adopts them',
    'expected one statement to name issues, comments, fixtures, generated docs, HTML/accessibility text, third-party material, untrusted data, and explicit user adoption',
  );

  return { passes, failures };
}
