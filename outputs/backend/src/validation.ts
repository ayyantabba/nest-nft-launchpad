import { z } from "zod";

/** Reject HTML/script-looking content and control characters in free-text fields. */
export function assertPlainText(field: string, value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) throw Object.assign(new Error(`${field.toUpperCase()}_REQUIRED`), { statusCode: 400 });
  if (trimmed.length > max) throw Object.assign(new Error(`${field.toUpperCase()}_TOO_LONG`), { statusCode: 400 });
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(trimmed)) {
    throw Object.assign(new Error(`${field.toUpperCase()}_CONTROL_CHARS`), { statusCode: 400 });
  }
  if (/[<>`]/.test(trimmed) || /javascript:/i.test(trimmed) || /on\w+\s*=/i.test(trimmed)) {
    throw Object.assign(new Error(`${field.toUpperCase()}_HTML_NOT_ALLOWED`), { statusCode: 400 });
  }
  return trimmed;
}

export const plainName = z.string().transform((value, ctx) => {
  try {
    return assertPlainText("name", value, 100);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

export const plainSymbol = z.string().transform((value, ctx) => {
  try {
    const symbol = assertPlainText("symbol", value, 12);
    if (!/^[A-Za-z0-9._-]+$/.test(symbol)) {
      ctx.addIssue({ code: "custom", message: "SYMBOL_INVALID_CHARS" });
      return z.NEVER;
    }
    return symbol;
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

export const plainDescription = z.string().transform((value, ctx) => {
  try {
    if (!value.trim()) return "";
    return assertPlainText("description", value, 5000);
  } catch (error) {
    ctx.addIssue({ code: "custom", message: (error as Error).message });
    return z.NEVER;
  }
});

/** 1 <= maxPerTransaction <= maxPerWallet <= maxSupply; royaltyBps 0..1000 (10%). */
export function assertMintLimits(input: {
  maxSupply: number;
  maxPerWallet: number;
  maxPerTransaction: number;
  royaltyBps: number;
}) {
  if (input.royaltyBps < 0 || input.royaltyBps > 1000) {
    throw Object.assign(new Error("ROYALTY_BPS_OUT_OF_RANGE"), { statusCode: 400 });
  }
  if (input.maxPerTransaction < 1) {
    throw Object.assign(new Error("MAX_PER_TRANSACTION_INVALID"), { statusCode: 400 });
  }
  if (input.maxPerWallet < 1) {
    throw Object.assign(new Error("MAX_PER_WALLET_INVALID"), { statusCode: 400 });
  }
  if (input.maxSupply < 1) {
    throw Object.assign(new Error("MAX_SUPPLY_INVALID"), { statusCode: 400 });
  }
  if (input.maxPerTransaction > input.maxPerWallet) {
    throw Object.assign(new Error("MAX_PER_TRANSACTION_EXCEEDS_WALLET"), {
      statusCode: 400,
      details: { field: "maxPerTransaction", message: "maxPerTransaction must be <= maxPerWallet" }
    });
  }
  if (input.maxPerWallet > input.maxSupply) {
    throw Object.assign(new Error("MAX_PER_WALLET_EXCEEDS_SUPPLY"), {
      statusCode: 400,
      details: { field: "maxPerWallet", message: "maxPerWallet must be <= maxSupply" }
    });
  }
  if (input.maxPerTransaction > input.maxSupply) {
    throw Object.assign(new Error("MAX_PER_TRANSACTION_EXCEEDS_SUPPLY"), {
      statusCode: 400,
      details: { field: "maxPerTransaction", message: "maxPerTransaction must be <= maxSupply" }
    });
  }
}

/** Token IDs must be unique and exactly the contiguous set 1..maxSupply. */
export function assertContiguousTokenIds(tokenIds: number[], maxSupply: number) {
  if (tokenIds.length !== maxSupply) {
    throw Object.assign(new Error("METADATA_SUPPLY_MISMATCH"), { statusCode: 400 });
  }
  const sorted = [...tokenIds].sort((a, b) => a - b);
  const unique = new Set(sorted);
  if (unique.size !== sorted.length) {
    throw Object.assign(new Error("METADATA_DUPLICATE_TOKEN_ID"), { statusCode: 400 });
  }
  for (let i = 0; i < maxSupply; i++) {
    if (sorted[i] !== i + 1) {
      throw Object.assign(new Error("METADATA_TOKEN_ID_SEQUENCE"), {
        statusCode: 400,
        details: { expected: `1..${maxSupply}`, message: "tokenIds must be unique and contiguous from 1 to maxSupply" }
      });
    }
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

export const SESSION_COOKIE = "nest_session";

export function sessionCookieHeader(token: string, maxAgeSeconds = 7 * 24 * 60 * 60): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookieHeader(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}
