import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TOKEN_VERSION = "v1";

function tokenKey() {
  const encoded = process.env.PLAID_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("PLAID_TOKEN_ENCRYPTION_KEY is required.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== KEY_BYTES) {
    throw new Error("PLAID_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptPlaidAccessToken(accessToken: string) {
  if (!accessToken.trim()) throw new Error("Cannot encrypt an empty Plaid access token.");
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(accessToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptPlaidAccessToken(envelope: string) {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] = envelope.split(".");
  if (version !== TOKEN_VERSION || !encodedIv || !encodedTag || !encodedCiphertext || extra) {
    throw new Error("Stored Plaid access token has an unsupported encrypted format.");
  }
  const decipher = createDecipheriv("aes-256-gcm", tokenKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
