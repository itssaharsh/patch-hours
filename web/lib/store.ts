import { neon } from "@neondatabase/serverless";
import type { Session } from "./types";

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

// One row per pairing code; sessions older than 30 days are deleted on create.
class PgStore implements Store {
  private sql: ReturnType<typeof neon>;
  private ready: Promise<unknown>;
  constructor(url: string) {
    this.sql = neon(url);
    this.ready = this.sql`create table if not exists ph_sessions (code text primary key, data jsonb not null, updated timestamptz not null default now())`;
  }
  async get(code: string) {
    await this.ready;
    const rows = (await this.sql`select data from ph_sessions where code = ${code}`) as { data: Session }[];
    return rows[0]?.data ?? null;
  }
  async put(s: Session) {
    await this.ready;
    await this.sql`update ph_sessions set data = ${JSON.stringify(s)}::jsonb, updated = now() where code = ${s.code}`;
  }
  async create(s: Session) {
    await this.ready;
    await this.sql`delete from ph_sessions where updated < now() - interval '30 days'`;
    const rows = (await this.sql`insert into ph_sessions (code, data) values (${s.code}, ${JSON.stringify(s)}::jsonb) on conflict do nothing returning code`) as unknown[];
    return rows.length === 1;
  }
}

const g = globalThis as unknown as { __patchStore?: Store };

export function store(): Store {
  if (g.__patchStore) return g.__patchStore;
  const url = process.env.DATABASE_URL;
  g.__patchStore = url && process.env.NODE_ENV !== "test" ? new PgStore(url) : new MemoryStore();
  return g.__patchStore;
}
