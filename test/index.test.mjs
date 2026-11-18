// Run: node test/index.test.mjs
import assert from "node:assert/strict";
import worker from "../src/index.js";

const H = "X-STTPS-Fallback";
const html = { Accept: "text/html" };
let passed = 0;
async function t(name, fn) {
  await fn();
  passed++;
  console.log("ok -", name);
}
const stubFetch = (impl) => {
  globalThis.fetch = impl;
};

await t("typo host gets the 503 maintenance page", async () => {
  const r = await worker.fetch(
    new Request("https://zz-typo-123.sttps.co/x", { headers: html }),
    {},
  );
  assert.equal(r.status, 503);
  assert.equal(r.headers.get(H), "unknown-host");
  assert.equal(r.headers.get("Retry-After"), "300");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal(r.headers.get("X-Robots-Tag"), "noindex");
  assert.match(await r.text(), /Sorry, we're under maintenance/);
});

await t("JSON / API request gets a JSON 503", async () => {
  const r = await worker.fetch(
    new Request("https://api-typo.sttps.co/v1", {
      method: "POST",
      headers: { Accept: "application/json" },
    }),
    {},
  );
  assert.equal(r.status, 503);
  assert.match(r.headers.get("Content-Type"), /application\/json/);
  assert.equal((await r.json()).error, "maintenance");
});

await t("HEAD gets a 503 with no body", async () => {
  const r = await worker.fetch(new Request("https://nope.sttps.co/", { method: "HEAD" }), {});
  assert.equal(r.status, 503);
  assert.equal(await r.text(), "");
});

await t("www.sttps.co 301s to sttps.co, keeping path and query", async () => {
  const r = await worker.fetch(new Request("http://www.sttps.co/a/b?c=1", { headers: html }), {});
  assert.equal(r.status, 301);
  assert.equal(r.headers.get("Location"), "https://sttps.co/a/b?c=1");
  assert.equal(r.headers.get(H), "redirect");
});

console.log(`\n${passed} passed`);
