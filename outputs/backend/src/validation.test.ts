import assert from "node:assert/strict";
import test from "node:test";
import {
  assertContiguousTokenIds,
  assertMintLimits,
  assertPlainText,
  clearSessionCookieHeader,
  parseCookies,
  sessionCookieHeader
} from "./validation.js";

test("plain text rejects HTML payloads", () => {
  assert.throws(() => assertPlainText("name", '<img src=x onerror=alert(1)>', 100), /HTML_NOT_ALLOWED/);
  assert.throws(() => assertPlainText("description", "<svg/onload=alert(1)>", 5000), /HTML_NOT_ALLOWED/);
  assert.equal(assertPlainText("name", "Nest Drops", 100), "Nest Drops");
});

test("mint limits enforce 1 <= tx <= wallet <= supply", () => {
  assert.throws(
    () => assertMintLimits({ maxSupply: 1, maxPerWallet: 1, maxPerTransaction: 99, royaltyBps: 500 }),
    /MAX_PER_TRANSACTION_EXCEEDS/
  );
  assert.throws(
    () => assertMintLimits({ maxSupply: 10, maxPerWallet: 20, maxPerTransaction: 2, royaltyBps: 500 }),
    /MAX_PER_WALLET_EXCEEDS_SUPPLY/
  );
  assert.throws(
    () => assertMintLimits({ maxSupply: 10, maxPerWallet: 5, maxPerTransaction: 1, royaltyBps: 2000 }),
    /ROYALTY_BPS_OUT_OF_RANGE/
  );
  assert.doesNotThrow(() =>
    assertMintLimits({ maxSupply: 100, maxPerWallet: 5, maxPerTransaction: 2, royaltyBps: 500 })
  );
});

test("token ids must be unique and contiguous 1..maxSupply", () => {
  assert.throws(() => assertContiguousTokenIds([1, 1], 2), /METADATA_DUPLICATE_TOKEN_ID/);
  assert.throws(() => assertContiguousTokenIds([1, 3], 3), /METADATA_TOKEN_ID_SEQUENCE|METADATA_SUPPLY_MISMATCH/);
  assert.throws(() => assertContiguousTokenIds([1, 2], 3), /METADATA_SUPPLY_MISMATCH/);
  assert.doesNotThrow(() => assertContiguousTokenIds([3, 1, 2], 3));
});

test("session cookie helpers", () => {
  const header = sessionCookieHeader("abc.def.ghi");
  assert.match(header, /HttpOnly/);
  assert.match(header, /Secure/);
  assert.match(header, /SameSite=None/);
  assert.match(clearSessionCookieHeader(), /Max-Age=0/);
  assert.equal(parseCookies("nest_session=tok%2Een; other=1").nest_session, "tok.en");
});
