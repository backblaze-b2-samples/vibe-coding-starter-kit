#!/usr/bin/env node
// Onboarding smoke test — drives the running API through the full file
// lifecycle (health → metrics → upload → list → download URL → delete → gone →
// stats) so QA can confirm a freshly-configured environment really works
// end-to-end in ~10s, without clicking through the browser UI.
//
// Zero dependencies (Node 20+ globals: fetch, FormData, Blob) so it runs on a
// fresh clone. It does NOT start anything — boot the stack first, then run it:
//
//   Terminal 1:  pnpm dev
//   Terminal 2:  pnpm smoke
//
// Point it elsewhere with SMOKE_API_URL, or it follows the same port logic as
// the dev scripts (NEXT_PUBLIC_API_URL / API_PORT, default :8000).

const API_BASE =
  process.env.SMOKE_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  `http://localhost:${process.env.API_PORT || 8000}`;

const checks = [];

function ok(name) {
  checks.push({ name, ok: true });
  console.log(`  ✓ ${name}`);
}

function bad(name, detail) {
  checks.push({ name, ok: false });
  console.error(`  ✗ ${name}`);
  if (detail) console.error(`      ${detail}`);
}

async function main() {
  console.log(`Smoke-testing API at ${API_BASE}\n`);

  // 1. Health — also our "is the server even up?" probe.
  let health;
  try {
    const res = await fetch(`${API_BASE}/health`);
    health = await res.json();
    if (res.ok) ok(`GET /health → ${health.status}`);
    else bad("GET /health", `HTTP ${res.status}`);
  } catch (err) {
    bad("GET /health", `${err.message} — is the API running? start it with \`pnpm dev\``);
    return finish(); // nothing else can pass if the server is down
  }
  if (health && health.b2_connected === false) {
    bad("B2 connectivity", "/health reports b2_connected=false — check your B2 creds in .env");
  } else {
    ok("B2 connectivity (b2_connected=true)");
  }

  // 2. Metrics endpoint (README advertises it).
  try {
    const res = await fetch(`${API_BASE}/metrics`);
    if (res.ok) ok("GET /metrics → 200");
    else bad("GET /metrics", `HTTP ${res.status}`);
  } catch (err) {
    bad("GET /metrics", err.message);
  }

  // 3. Upload a unique throwaway file.
  const filename = `smoke-${Date.now()}.txt`;
  const body = "vibe-kit onboarding smoke\n";
  let key;
  try {
    const form = new FormData();
    form.append("file", new Blob([body], { type: "text/plain" }), filename);
    const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
    const data = await res.json();
    if (res.ok && data.key) {
      key = data.key;
      ok(`POST /upload → ${key}`);
    } else {
      bad("POST /upload", `HTTP ${res.status}: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    bad("POST /upload", err.message);
  }

  if (key) {
    // 4. The file is listed.
    try {
      const res = await fetch(`${API_BASE}/files?prefix=uploads&limit=100`);
      const files = await res.json();
      if (res.ok && Array.isArray(files) && files.some((f) => f.key === key)) {
        ok("GET /files lists the upload");
      } else {
        bad("GET /files", "uploaded key not present in listing");
      }
    } catch (err) {
      bad("GET /files", err.message);
    }

    // 5. A presigned download URL resolves and actually serves the bytes.
    try {
      const res = await fetch(`${API_BASE}/files/${key}/download`);
      const data = await res.json();
      if (res.ok && data.url) {
        const dl = await fetch(data.url);
        const text = await dl.text();
        if (dl.ok && text === body) ok("download URL serves the original bytes");
        else bad("download URL", `fetch HTTP ${dl.status} / body mismatch`);
      } else {
        bad("GET /files/{key}/download", `HTTP ${res.status}`);
      }
    } catch (err) {
      bad("download URL", err.message);
    }

    // 6. Delete it, then confirm it's gone.
    try {
      const res = await fetch(`${API_BASE}/files/${key}`, { method: "DELETE" });
      if (res.ok) ok("DELETE /files/{key}");
      else bad("DELETE /files/{key}", `HTTP ${res.status}`);

      const gone = await fetch(`${API_BASE}/files/${key}`);
      if (gone.status === 404) ok("file is gone after delete (404)");
      else bad("post-delete check", `expected 404, got ${gone.status}`);
    } catch (err) {
      bad("DELETE /files/{key}", err.message);
    }
  }

  // 7. Stats endpoint responds.
  try {
    const res = await fetch(`${API_BASE}/files/stats`);
    if (res.ok) ok("GET /files/stats → 200");
    else bad("GET /files/stats", `HTTP ${res.status}`);
  } catch (err) {
    bad("GET /files/stats", err.message);
  }

  finish();
}

function finish() {
  const failed = checks.filter((c) => !c.ok).length;
  console.log("");
  if (failed === 0) {
    console.log(`✓ smoke: ${checks.length} checks passed`);
    process.exit(0);
  }
  console.error(`✗ smoke: ${failed}/${checks.length} checks failed`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
