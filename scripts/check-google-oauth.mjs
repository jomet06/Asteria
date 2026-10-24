/* M3.7.1 offline checks: no Google credentials or live database required. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRequire = createRequire(import.meta.url);
const folder = "features/calendar/google/";

function load(name, mocks = {}) {
  const path = resolve(root, folder, name);
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    fileName: path,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const moduleRecord = { exports: {} };
  const require = (spec) => {
    if (mocks[spec]) return mocks[spec];
    if (spec.startsWith("./")) return load(`${spec.slice(2)}.ts`, mocks);
    return nativeRequire(spec);
  };
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })(require, moduleRecord, moduleRecord.exports);
  return moduleRecord.exports;
}

test("Google OAuth nonce is tied to owner and expires", () => {
  const state = load("state.ts");
  const now = Date.now();
  const { nonce, cookieValue } = state.createGoogleOAuthState("ownerA", now);
  assert.equal(state.verifyGoogleOAuthState(cookieValue, nonce, "ownerA", now + 1000), true);
  assert.equal(state.verifyGoogleOAuthState(cookieValue, nonce, "ownerB", now + 1000), false);
  assert.equal(state.verifyGoogleOAuthState(cookieValue, "wrong", "ownerA", now + 1000), false);
  assert.equal(state.verifyGoogleOAuthState(cookieValue, nonce, "ownerA", now + 601000), false);
});

test("Google refresh tokens are authenticated and encrypted", () => {
  const original = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = "ab".repeat(32);
  try {
    const crypt = load("crypto.ts");
    const encrypted = crypt.encryptGoogleRefreshToken("sensitive-refresh-token");
    assert.ok(!encrypted.includes("sensitive-refresh-token"));
    assert.equal(crypt.decryptGoogleRefreshToken(encrypted), "sensitive-refresh-token");
    const altered = encrypted.split(".");
    altered[3] = Buffer.from("tampered").toString("base64url");
    assert.throws(() => crypt.decryptGoogleRefreshToken(altered.join(".")));
  } finally {
    if (original === undefined) delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = original;
  }
});

test("Google OAuth authorization URL uses offline access and two-way scopes", () => {
  const old = [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI];
  process.env.GOOGLE_CLIENT_ID = "test-client";
  process.env.GOOGLE_CLIENT_SECRET = "test-secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/integrations/google/callback";
  try {
    const { buildGoogleAuthorizationUrl } = load("oauth.ts");
    const url = new URL(buildGoogleAuthorizationUrl("test-state"));
    assert.equal(url.host, "accounts.google.com");
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("state"), "test-state");
    const scopes = url.searchParams.get("scope").split(" ");
    assert.ok(scopes.includes("https://www.googleapis.com/auth/calendar.events"));
    assert.ok(scopes.includes("https://www.googleapis.com/auth/calendar.calendars"));
    assert.ok(!scopes.includes("https://www.googleapis.com/auth/calendar"));
  } finally {
    [process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, process.env.GOOGLE_REDIRECT_URI] = old;
    ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"].forEach((key, index) => {
      if (old[index] === undefined) delete process.env[key];
    });
  }
});
