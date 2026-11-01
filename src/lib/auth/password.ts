import {
  createHash,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
  type ScryptOptions,
} from "crypto";

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;

/**
 * Generates a memory-hard scrypt password hash formatted as:
 * scrypt$16384$8$1$<saltHex>$<derivedKeyHex>
 */
export async function hashPasswordScrypt(password: string): Promise<string> {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = randomBytes(16);
  const derived = (await scryptAsync(password, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  })) as Buffer;

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export interface PasswordVerifyResult {
  valid: boolean;
  usedLegacySha256: boolean;
  errorReason?: string;
}

/**
 * Verifies a password against a stored password hash in constant time.
 * - Primary algorithm: scrypt (`scrypt$N$r$p$saltHex$hashHex`)
 * - Plain SHA-256 is REJECTED by default. It is only accepted if
 *   `allowLegacySha256Compat` is explicitly true (`ALLOW_LEGACY_SHA256_HASH=true`).
 */
export async function verifyPasswordHash(
  password: string,
  storedHash: string,
  options?: { allowLegacySha256Compat?: boolean }
): Promise<PasswordVerifyResult> {
  if (!password || !storedHash) {
    return { valid: false, usedLegacySha256: false };
  }

  const trimmed = storedHash.trim();

  if (trimmed.startsWith("scrypt$")) {
    const parts = trimmed.split("$");
    if (parts.length !== 6) {
      return {
        valid: false,
        usedLegacySha256: false,
        errorReason: "Malformed scrypt hash format",
      };
    }

    const N = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    const salt = Buffer.from(parts[4], "hex");
    const expected = Buffer.from(parts[5], "hex");

    if (
      !Number.isInteger(N) ||
      N < 1024 ||
      !Number.isInteger(r) ||
      r < 1 ||
      !Number.isInteger(p) ||
      p < 1 ||
      salt.length < 8 ||
      expected.length < 32
    ) {
      return {
        valid: false,
        usedLegacySha256: false,
        errorReason: "Invalid scrypt parameters",
      };
    }

    const derived = (await scryptAsync(password, salt, expected.length, {
      N,
      r,
      p,
      maxmem: 64 * 1024 * 1024,
    })) as Buffer;

    const valid =
      derived.length === expected.length && timingSafeEqual(derived, expected);
    return { valid, usedLegacySha256: false };
  }

  // Detect SHA-256 hashes (`sha256$<64hex>` or raw 64-char hex)
  const isSha256Prefixed = /^sha256\$[a-fA-F0-9]{64}$/.test(trimmed);
  const isRawSha256Hex = /^[a-fA-F0-9]{64}$/.test(trimmed);

  if (isSha256Prefixed || isRawSha256Hex) {
    const allowCompat =
      options?.allowLegacySha256Compat ??
      process.env.ALLOW_LEGACY_SHA256_HASH === "true";

    if (!allowCompat) {
      return {
        valid: false,
        usedLegacySha256: false,
        errorReason:
          "Plain SHA-256 password hashes are rejected for security. Generate an scrypt hash (or set ALLOW_LEGACY_SHA256_HASH=true temporarily during migration).",
      };
    }

    const hexPart = isSha256Prefixed ? trimmed.slice(7) : trimmed;
    const expected = Buffer.from(hexPart.toLowerCase(), "hex");
    const actual = createHash("sha256").update(password, "utf8").digest();
    const valid =
      actual.length === expected.length && timingSafeEqual(actual, expected);
    return { valid, usedLegacySha256: valid };
  }

  return {
    valid: false,
    usedLegacySha256: false,
    errorReason: "Unsupported password hash format. Expected scrypt$...",
  };
}
