/**
 * The section skeleton of docs/app-workflows.md.
 *
 * Deliberately NOT marker-delimited. Every bullet in that file is behavioural
 * prose encoding a real UX decision — why a dialog is held open against the
 * primitive's default, why folders auto-expand until the majority of listed
 * items are reachable — and templating any of it would make each app's docs
 * worse. What is mechanical is the *shape*: which journeys exist, in what
 * order, and where each one links. Wrapping eight marker lines around four
 * one-line footers to manage that would be worse than managing it directly.
 *
 * So this module owns exactly two things per screen-bearing feature:
 *   - a `## <heading>` section exists, in manifest order
 *   - that section's last line is its `- See: [Title](features/….md)` link
 *
 * Sections the manifest does not know about are left alone, after the managed
 * ones: an app is free to document journeys that are not features.
 */

const FILE = "docs/app-workflows.md";
const SEE = /^- See: /;

function headingOf(feature) {
  return `## ${feature.workflow_heading ?? feature.title}`;
}

function seeLine(feature) {
  // Links inside docs/ are written relative to docs/.
  return `- See: [${feature.title}](${feature.doc.replace(/^docs\//, "")})`;
}

/** Split into the preamble and one block per `## ` section. */
function parse(text) {
  const lines = text.split("\n");
  const start = lines.findIndex((line) => line.startsWith("## "));

  if (start === -1) {
    return { preamble: text.trimEnd(), blocks: [] };
  }

  const preamble = lines.slice(0, start).join("\n").trimEnd();
  const blocks = [];

  for (const line of lines.slice(start)) {
    if (line.startsWith("## ")) {
      blocks.push({ heading: line, body: [] });
    } else {
      blocks.at(-1).body.push(line);
    }
  }

  return { preamble, blocks };
}

function render(preamble, blocks) {
  const rendered = blocks.map((block) =>
    [block.heading, ...block.body].join("\n").trimEnd(),
  );
  return `${[preamble, ...rendered].join("\n\n")}\n`;
}

/**
 * @returns {{file: string, text: string, changed: boolean}} the same shape the
 * marker-driven modules return, so the caller can plan every write before
 * performing any of them.
 */
export function syncWorkflows(ctx, io) {
  const original = io.read(FILE);
  const { preamble, blocks } = parse(original);
  const managed = [];
  const byHeading = new Map(blocks.map((block) => [block.heading, block]));

  for (const feature of ctx.screens) {
    const heading = headingOf(feature);
    const want = seeLine(feature);
    const block = byHeading.get(heading) ?? { heading, body: ["", "- (describe this journey)"] };

    byHeading.delete(heading);

    const body = [...block.body];
    while (body.length > 0 && body.at(-1).trim() === "") {
      body.pop();
    }

    if (body.length > 0 && SEE.test(body.at(-1))) {
      body[body.length - 1] = want;
    } else {
      body.push(want);
    }

    managed.push({ heading, body });
  }

  const extra = blocks.filter((block) => byHeading.has(block.heading));
  const text = render(preamble, [...managed, ...extra]);

  return { file: FILE, text, changed: text !== original };
}
