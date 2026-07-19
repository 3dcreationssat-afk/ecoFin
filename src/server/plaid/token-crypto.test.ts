// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { decryptPlaidAccessToken, encryptPlaidAccessToken } from "./token-crypto";

const originalKey = process.env.PLAID_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.PLAID_TOKEN_ENCRYPTION_KEY;
  else process.env.PLAID_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("Plaid access-token encryption", () => {
  it("round-trips an authenticated envelope without retaining plaintext", () => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const token = "synthetic-token-value";
    const encrypted = encryptPlaidAccessToken(token);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(token);
    expect(decryptPlaidAccessToken(encrypted)).toBe(token);
  });

  it("fails authentication with a different key", () => {
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64");
    const encrypted = encryptPlaidAccessToken("synthetic-token-value");
    process.env.PLAID_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
    expect(() => decryptPlaidAccessToken(encrypted)).toThrow();
  });
});
