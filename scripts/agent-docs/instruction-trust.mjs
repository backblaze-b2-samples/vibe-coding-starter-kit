/** Instruction-trust boundary coverage for `pnpm check:agent-docs`. */

import { sectionBody } from "./markdown.mjs";

function sentenceWith(body, tests) {
  return body
    .split(/\r?\n|(?<=[.!?])\s+/)
    .some((sentence) => tests.every((test) => test.test(sentence)));
}

export function checkInstructionTrustBoundary(markdown) {
  const passes = [];
  const failures = [];
  const boundary = sectionBody(markdown, /instruction authority/i);
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
