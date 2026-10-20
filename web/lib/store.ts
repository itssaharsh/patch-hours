import { Redis } from "@upstash/redis";
import type { Session } from "./types";

const TTL_S = 30 * 24 * 3600;

export interface Store {
  get(code: string): Promise<Session | null>;
  put(s: Session): Promise<void>;
  create(s: Session): Promise<boolean>; // false if the code exists
}

class MemoryStore implements Store {
  m = new Map<string, Session>();
  async get(code: string) { return this.m.get(code) ?? null; }
  async put(s: Session) { this.m.set(s.code, s); }
  async create(s: Session) { if (this.m.has(s.code)) return false; this.m.set(s.code, s); return true; }
}

class RedisStore implements Store {
  constructor(private r: Redis) {}
  async get(code: string) { return (await this.r.get<Session>(`s:${code}`)) ?? null; }
  async put(s: Session) { await this.r.set(`s:${s.code}`, s, { ex: TTL_S }); }
  async create(s: Session) { return (await this.r.set(`s:${s.code}`, s, { ex: TTL_S, nx: true })) === "OK"; }
}

const g = globalThis as unknown as { __patchStore?: Store };

export function store(): Store {
  if (g.__patchStore) return g.__patchStore;
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  g.__patchStore = url && token ? new RedisStore(new Redis({ url, token })) : new MemoryStore();
  return g.__patchStore;
}

export function storeKind(): "redis" | "memory" {
  return store() instanceof RedisStore ? "redis" : "memory";
}
