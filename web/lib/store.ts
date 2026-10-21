import { neon } from "@neondatabase/serverless";
import type { Session } from "./types";

export class Conflict extends Error {}

export interface Store {
  get(code: string): Promise<Session | null>;
  create(s: Session): Promise<boolean>; // false if the code exists
  /** Read, change and write one session; retried when another request wrote it in between. */
  mutate(code: string, fn: (s: Session) => Session): Promise<Session | null>;
}

abstract class Base implements Store {
  abstract get(code: string): Promise<Session | null>;
  abstract create(s: Session): Promise<boolean>;
  protected abstract putIf(s: Session, prevV: number): Promise<boolean>;
  async mutate(code: string, fn: (s: Session) => Session) {
    for (let i = 0; i < 5; i++) {
      const cur = await this.get(code);
      if (!cur) return null;
      const prevV = cur.v ?? 0;
      const next = { ...fn(cur), v: prevV + 1 };
      if (await this.putIf(next, prevV)) return next;
    }
    throw new Conflict("busy");
  }
}

class MemoryStore extends Base {
  m = new Map<string, Session>();
  async get(code: string) { const s = this.m.get(code); return s ? structuredClone(s) : null; }
  async create(s: Session) { if (this.m.has(s.code)) return false; this.m.set(s.code, structuredClone(s)); return true; }
  protected async putIf(s: Session, prevV: number) {
    const cur = this.m.get(s.code);
    if (!cur || (cur.v ?? 0) !== prevV) return false;
    this.m.set(s.code, structuredClone(s));
    return true;
  }
}

// One row per pairing code; sessions older than 30 days are deleted on create.
class PgStore extends Base {
  private sql: ReturnType<typeof neon>;
  private ready: Promise<unknown>;
  constructor(url: string) {
    super();
    this.sql = neon(url);
    this.ready = this.sql`create table if not exists ph_sessions (code text primary key, data jsonb not null, updated timestamptz not null default now())`;
  }
  async get(code: string) {
    await this.ready;
    const rows = (await this.sql`select data from ph_sessions where code = ${code}`) as { data: Session }[];
    return rows[0]?.data ?? null;
  }
  async create(s: Session) {
    await this.ready;
    await this.sql`delete from ph_sessions where updated < now() - interval '30 days'`;
    const rows = (await this.sql`insert into ph_sessions (code, data) values (${s.code}, ${JSON.stringify(s)}::jsonb) on conflict do nothing returning code`) as unknown[];
    return rows.length === 1;
  }
  protected async putIf(s: Session, prevV: number) {
    await this.ready;
    const rows = (await this.sql`update ph_sessions set data = ${JSON.stringify(s)}::jsonb, updated = now()
      where code = ${s.code} and coalesce((data->>'v')::int, 0) = ${prevV} returning code`) as unknown[];
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
