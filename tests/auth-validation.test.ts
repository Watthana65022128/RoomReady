import test from "node:test";
import assert from "node:assert/strict";
import {
  isStrongPassword,
  isValidEmail,
  passwordChecks,
} from "../src/lib/auth-validation.ts";

test("accepts well-formed email addresses", () => {
  assert.equal(isValidEmail("owner+room@example.co.th"), true);
  assert.equal(isValidEmail("OWNER@example.com"), true);
});

test("rejects malformed email addresses", () => {
  for (const email of [
    "owner@example",
    "owner@@example.com",
    ".owner@example.com",
    "owner..room@example.com",
    "owner@-example.com",
    "owner@example.c",
  ]) {
    assert.equal(isValidEmail(email), false, email);
  }
});

test("requires every strong-password rule", () => {
  assert.equal(isStrongPassword("RoomReady#2026"), true);
  assert.equal(isStrongPassword("roomready#2026"), false);
  assert.equal(isStrongPassword("ROOMREADY#2026"), false);
  assert.equal(isStrongPassword("RoomReady####"), false);
  assert.equal(isStrongPassword("RoomReady2026"), false);
  assert.equal(isStrongPassword("Short#1A"), true);
  assert.equal(passwordChecks("RoomReady#2026").length, true);
});
