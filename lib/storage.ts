/**
 * Three-tier storage abstraction.
 *
 * Tier 1 — Upstash Redis: used when UPSTASH_REDIS_REST_URL env var is present (Vercel / cloud).
 * Tier 2 — JSON file:     used locally; persists to data/store.json across server restarts.
 * Tier 3 — In-memory Map: fallback if the file system is unavailable.
 *
 * All three tiers expose the same async get / set / del / keys API.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type Envelope<T> = { value: T; expiresAt?: number };
type RawStore = Record<string, Envelope<unknown>>;

// ---------------------------------------------------------------------------
// Tier 3 — In-memory fallback
// ---------------------------------------------------------------------------

const mem = new Map<string, Envelope<unknown>>();

function memGet<T>(key: string): T | null {
  const e = mem.get(key);
  if (!e) return null;
  if (e.expiresAt && Date.now() > e.expiresAt) { mem.delete(key); return null; }
  return e.value as T;
}
function memSet<T>(key: string, value: T, ttl?: number) {
  mem.set(key, { value, expiresAt: ttl ? Date.now() + ttl * 1000 : undefined });
}
function memDel(key: string) { mem.delete(key); }
function memKeys(prefix: string): string[] {
  const now = Date.now();
  return [...mem.entries()]
    .filter(([k, v]) => k.startsWith(prefix) && !(v.expiresAt && now > v.expiresAt))
    .map(([k]) => k);
}

// ---------------------------------------------------------------------------
// Tier 2 — JSON file
// ---------------------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");

function readDisk(): RawStore {
  try {
    if (!fs.existsSync(STORE_FILE)) return {};
    return JSON.parse(fs.readFileSync(STORE_FILE, "utf8")) as RawStore;
  } catch {
    return {};
  }
}

function writeDisk(store: RawStore) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
}

function fileGet<T>(key: string): T | null {
  try {
    const store = readDisk();
    const e = store[key];
    if (!e) return null;
    if (e.expiresAt && Date.now() > e.expiresAt) {
      delete store[key];
      writeDisk(store);
      return null;
    }
    return e.value as T;
  } catch {
    return memGet<T>(key);
  }
}

function fileSet<T>(key: string, value: T, ttl?: number) {
  try {
    const store = readDisk();
    store[key] = { value, expiresAt: ttl ? Date.now() + ttl * 1000 : undefined };
    writeDisk(store);
  } catch {
    memSet(key, value, ttl);
  }
}

function fileDel(key: string) {
  try {
    const store = readDisk();
    delete store[key];
    writeDisk(store);
  } catch {
    memDel(key);
  }
}

function fileKeys(prefix: string): string[] {
  try {
    const now = Date.now();
    return Object.entries(readDisk())
      .filter(([k, v]) => k.startsWith(prefix) && !(v.expiresAt && now > v.expiresAt))
      .map(([k]) => k);
  } catch {
    return memKeys(prefix);
  }
}

// ---------------------------------------------------------------------------
// Tier 1 — Upstash (lazy import — only when env vars present)
// ---------------------------------------------------------------------------

const USE_UPSTASH = Boolean(process.env.UPSTASH_REDIS_REST_URL);

type UpstashClient = {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number }) => Promise<unknown>;
  del: (...keys: string[]) => Promise<unknown>;
  keys: (pattern: string) => Promise<string[]>;
};

let _upstash: UpstashClient | null = null;
async function getUpstash(): Promise<UpstashClient> {
  if (_upstash) return _upstash;
  const { Redis } = await import("@upstash/redis");
  const r = Redis.fromEnv();
  _upstash = {
    get: (key) => r.get(key),
    set: (key, value, opts) => r.set(key, value, opts as Parameters<typeof r.set>[2]),
    del: (...keys) => r.del(...keys),
    keys: (pattern) => r.keys(pattern),
  };
  return _upstash;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function storageGet<T>(key: string): Promise<T | null> {
  if (USE_UPSTASH) return (await getUpstash()).get<T>(key);
  return fileGet<T>(key);
}

export async function storageSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number,
): Promise<void> {
  if (USE_UPSTASH) {
    await (await getUpstash()).set(key, value, ttlSeconds ? { ex: ttlSeconds } : undefined);
    return;
  }
  fileSet(key, value, ttlSeconds);
}

export async function storageDel(key: string): Promise<void> {
  if (USE_UPSTASH) { await (await getUpstash()).del(key); return; }
  fileDel(key);
}

export async function storageKeys(prefix: string): Promise<string[]> {
  if (USE_UPSTASH) return (await getUpstash()).keys(`${prefix}*`);
  return fileKeys(prefix);
}
