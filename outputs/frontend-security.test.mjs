import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(root, "app.js"), "utf8");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

test("XSS payloads escape to inert text", () => {
  const payloads = [
    '<img src=x onerror=alert(1)>',
    "<svg/onload=alert(1)>",
    `"><img src=x onerror=alert(1)>`
  ];
  for (const payload of payloads) {
    const escaped = escapeHtml(payload);
    // Angle brackets must be entity-encoded so the browser cannot create tags.
    assert.equal(escaped.includes("<"), false);
    assert.equal(escaped.includes(">"), false);
    assert.match(escaped, /&lt;/);
    assert.match(escaped, /&gt;/);
  }
});

test("app.js uses display-time escaping helpers", () => {
  assert.match(appSource, /function escapeHtml\(/);
  assert.match(appSource, /function escapeAttr\(/);
  assert.match(appSource, /function displayText\(/);
  assert.match(appSource, /function safeCssUrl\(/);
  assert.match(appSource, /credentials:\s*["']include["']/);
  assert.match(appSource, /localStorage\.removeItem\(["']nestAuthToken["']\)/);
  assert.equal(appSource.includes('localStorage.setItem("nestAuthToken"'), false);
  assert.match(appSource, /displayText\(c\.name\)/);
  assert.match(appSource, /displayText\(c\.description\)/);
});

test("platformRow and mintModule do not interpolate raw c.name", () => {
  const platformRow = appSource.match(/function platformRow\(c\) \{[\s\S]*?\n\}/);
  assert.ok(platformRow);
  assert.equal(platformRow[0].includes("${c.name}"), false);
  assert.equal(platformRow[0].includes("${c.description}"), false);
  const mintModule = appSource.match(/function mintModule\(c\) \{[\s\S]*?\nfunction /);
  assert.ok(mintModule);
  assert.match(mintModule[0], /displayText\(c\.name\)/);
  assert.match(mintModule[0], /displayText\(c\.description\)/);
});
