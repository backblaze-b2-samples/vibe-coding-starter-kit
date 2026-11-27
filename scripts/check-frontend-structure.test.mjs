// Tests for scripts/check-frontend-structure.mjs.
// Run via: pnpm check:structure:web (which runs these tests, then the checker)
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { scanSource } from "./check-frontend-structure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures", "frontend-structure");
const CHECKER = join(HERE, "check-frontend-structure.mjs");
const COMPONENT_PATH = "apps/web/src/components/example.tsx";

function fixtureNames(kind) {
  return readdirSync(join(FIXTURES, kind)).sort();
}

function read(kind, name) {
  return readFileSync(join(FIXTURES, kind, name), "utf8");
}

describe("violating fixtures", () => {
  for (const name of fixtureNames("violations")) {
    it(`flags ${name}`, () => {
      // The extension is part of the scan: .js/.jsx/.mjs must be parsed too.
      const found = scanSource(`apps/web/src/components/${name}`, read("violations", name));
      assert.ok(found.length > 0, `expected a violation in ${name}, found none`);
    });
  }
});

describe("clean fixtures", () => {
  for (const name of fixtureNames("clean")) {
    it(`accepts ${name}`, () => {
      const found = scanSource(`apps/web/src/components/${name}`, read("clean", name));
      assert.deepEqual(found, []);
    });
  }
});

describe("where each construct is allowed", () => {
  it("allows the global fetch and XMLHttpRequest only in lib/api-client.ts", () => {
    const source = 'export const a = () => fetch("/x");\nexport const b = new XMLHttpRequest();\n';
    assert.deepEqual(scanSource("apps/web/src/lib/api-client.ts", source), []);
    assert.ok(scanSource("apps/web/src/lib/other.ts", source).length >= 2);
  });

  it("allows react-query imports anywhere under lib/ but not in components", () => {
    const source = 'import { useQuery } from "@tanstack/react-query";\nexport const q = useQuery;\n';
    assert.deepEqual(scanSource("apps/web/src/lib/queries.ts", source), []);
    assert.equal(scanSource(COMPONENT_PATH, source).length, 1);
  });

  it("does not scan test files, which stub the network on purpose", () => {
    const source = 'globalThis.fetch = () => Promise.resolve(new Response("{}"));\n';
    assert.deepEqual(scanSource("apps/web/src/lib/api-client.test.ts", source), []);
  });

  it("reports the line of a violation", () => {
    const [violation] = scanSource(COMPONENT_PATH, "export const a = 1;\n\nfetch(\"/x\");\n");
    assert.equal(violation.line, 3);
  });

  it("names an exported helper, not the private apiFetch, in its fetch message", () => {
    const [violation] = scanSource(COMPONENT_PATH, 'fetch("/x");\n');
    assert.match(violation.message, /lib\/api-client\.ts/);
    assert.doesNotMatch(violation.message, /apiFetch/);
  });
});

describe("command line", () => {
  function run(root) {
    return spawnSync(process.execPath, [CHECKER, "--root", root], { encoding: "utf8" });
  }

  function tempTree() {
    const root = mkdtempSync(join(tmpdir(), "frontend-structure-"));
    mkdirSync(join(root, "apps", "web", "src", "components"), { recursive: true });
    return root;
  }

  it("exits 0 on a clean tree", () => {
    const root = tempTree();
    try {
      cpSync(
        join(FIXTURES, "clean", "lookalikes.tsx"),
        join(root, "apps", "web", "src", "components", "lookalikes.tsx"),
      );
      const result = run(root);
      assert.equal(result.status, 0, result.stderr);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("exits 1 and names the file on a violating tree", () => {
    const root = tempTree();
    try {
      cpSync(
        join(FIXTURES, "violations", "window-fetch.tsx"),
        join(root, "apps", "web", "src", "components", "window-fetch.tsx"),
      );
      const result = run(root);
      assert.equal(result.status, 1);
      assert.match(result.stderr, /components\/window-fetch\.tsx/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("passes on the repository's own frontend", () => {
    const result = run(resolve(HERE, ".."));
    assert.equal(result.status, 0, result.stderr);
  });
});
