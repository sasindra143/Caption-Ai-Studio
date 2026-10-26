import assert from "node:assert/strict";
import test from "node:test";
import { geminiClientMessage, geminiHttpStatus, geminiSafeDiagnostic } from "./gemini-errors";

test("maps Gemini API errors to distinct client statuses", () => {
  const cases = [
    [400, 400],
    [401, 503],
    [403, 503],
    [404, 503],
    [429, 429],
    [500, 503],
    [503, 503],
  ] as const;
  for (const [upstreamStatus, expectedStatus] of cases) {
    assert.equal(geminiHttpStatus({ status: upstreamStatus, message: "upstream error" }), expectedStatus);
  }
});

test("extracts safe Google error details from the GenAI SDK ApiError message", () => {
  const error = Object.assign(new Error(JSON.stringify({
    error: { code: 403, status: "PERMISSION_DENIED", message: "API key not valid" },
  })), { status: 403 });
  assert.equal(geminiHttpStatus(error), 503);
  assert.match(geminiClientMessage(error), /credentials or permissions/);
  assert.match(geminiSafeDiagnostic(error), /status=403 code=PERMISSION_DENIED/);
});

test("does not include API keys, bearer tokens, URLs, or paths in diagnostics", () => {
  const diagnostic = geminiSafeDiagnostic(new Error(
    "AIzaSy0123456789012345678901234567890 Bearer very-secret https://example.test/path C:\\private\\upload.mp4",
  ));
  assert.doesNotMatch(diagnostic, /AIzaSy|very-secret|example\.test|private|upload\.mp4/);
});

test("distinguishes invalid requests, quota, and upstream timeouts", () => {
  assert.equal(geminiHttpStatus({ status: 400 }), 400);
  assert.equal(geminiHttpStatus({ status: 429 }), 429);
  assert.equal(geminiHttpStatus(new Error("request timed out")), 504);
});
