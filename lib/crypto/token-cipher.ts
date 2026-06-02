import crypto from "node:crypto";

/**
 * Symmetric encryption for OAuth secrets at rest (Google refresh/access tokens).
 *
 * Uses AES-256-GCM with a 32-byte key supplied via TOKEN_ENCRYPTION_KEY
 * (base64-encoded). When no key is configured (e.g. local dev) values are
 * stored as plaintext so the app keeps working — this is documented as a dev-only
 * fallback. The stored format is self-describing so decrypt can tell the two apart:
 *
 *   gcm1.<iv-b64>.<tag-b64>.<ciphertext-b64>   (encrypted)
 *   <plaintext>                                 (no key was set at write time)
 */

const ENC_PREFIX = "gcm1.";

let cachedKey: Buffer | null | undefined;

function getKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;

  const raw = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  if (!raw) {
    cachedKey = null;
    return cachedKey;
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, "base64");
  } catch {
    console.error("[token-cipher] TOKEN_ENCRYPTION_KEY is not valid base64; storing tokens unencrypted");
    cachedKey = null;
    return cachedKey;
  }

  if (key.length !== 32) {
    console.error(
      `[token-cipher] TOKEN_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}); storing tokens unencrypted`,
    );
    cachedKey = null;
    return cachedKey;
  }

  cachedKey = key;
  return cachedKey;
}

/** Encrypt a secret for storage. Returns plaintext unchanged when no key is set. */
export function encryptSecret(plain: string): string {
  const key = getKey();
  if (!key) return plain;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
}

/**
 * Decrypt a stored secret. Plaintext values (written when no key was set) are
 * returned as-is. Returns null if a ciphertext can't be decrypted (e.g. the key
 * rotated or is missing) so callers can treat it as "no usable token".
 */
export function decryptSecret(stored: string): string | null {
  if (!stored.startsWith(ENC_PREFIX)) {
    // Written as plaintext (no key at write time).
    return stored;
  }

  const key = getKey();
  if (!key) {
    console.error("[token-cipher] encrypted token present but TOKEN_ENCRYPTION_KEY is not set");
    return null;
  }

  try {
    const [, ivB64, tagB64, ctB64] = stored.split(".");
    if (!ivB64 || !tagB64 || !ctB64) return null;
    const iv = Buffer.from(ivB64, "base64");
    const tag = Buffer.from(tagB64, "base64");
    const ciphertext = Buffer.from(ctB64, "base64");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return plain.toString("utf8");
  } catch (error) {
    console.error("[token-cipher] failed to decrypt stored token", error);
    return null;
  }
}
