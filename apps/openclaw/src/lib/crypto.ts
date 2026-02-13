/**
 * AES-256-GCM encryption for credential storage.
 * Key derived from CREDENTIAL_ENCRYPTION_KEY env var.
 */
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const SALT = "openclaw-credential-salt"; // Static salt is fine — key is already high-entropy

function getKey(): Buffer {
  const envKey = process.env.CREDENTIAL_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY env var is required for credential encryption",
    );
  }
  return scryptSync(envKey, SALT, 32);
}

/** Encrypt a plaintext string. Returns base64-encoded `iv:ciphertext:tag`. */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Store as: base64(iv):base64(encrypted):base64(tag)
  return `${iv.toString("base64")}:${encrypted.toString("base64")}:${tag.toString("base64")}`;
}

/** Decrypt a string produced by encrypt(). */
export function decrypt(encoded: string): string {
  const key = getKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format");
  }
  const iv = Buffer.from(parts[0]!, "base64");
  const encrypted = Buffer.from(parts[1]!, "base64");
  const tag = Buffer.from(parts[2]!, "base64");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}

/** Check if a value looks like it's already encrypted (has the iv:data:tag format). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  try {
    Buffer.from(parts[0]!, "base64");
    Buffer.from(parts[1]!, "base64");
    Buffer.from(parts[2]!, "base64");
    return true;
  } catch {
    return false;
  }
}
