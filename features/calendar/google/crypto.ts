import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function encryptionKey(): Buffer {
  const raw = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
  if (!raw || !/^[a-fA-F0-9]{64}$/.test(raw)) {
    throw new Error("GOOGLE_TOKEN_ENCRYPTION_KEY must be a 64-character hexadecimal value.");
  }
  return Buffer.from(raw, "hex");
}

/** AES-256-GCM; only encrypted refresh tokens may be persisted. */
export function encryptGoogleRefreshToken(token: string): string {
  if (!token) throw new Error("Cannot encrypt an empty Google refresh token.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

/** For future sync jobs; throws if ciphertext/key is invalid or modified. */
export function decryptGoogleRefreshToken(stored: string): string {
  const pieces = stored.split(".");
  if (pieces.length !== 4 || pieces[0] !== "v1") {
    throw new Error("Unsupported Google token format.");
  }
  const [, encodedIv, encodedTag, encodedData] = pieces;
  const iv = Buffer.from(encodedIv, "base64url");
  const tag = Buffer.from(encodedTag, "base64url");
  const data = Buffer.from(encodedData, "base64url");
  if (iv.length !== 12 || tag.length !== 16 || data.length === 0) {
    throw new Error("Malformed encrypted Google token.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
