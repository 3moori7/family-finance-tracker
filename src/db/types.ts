export type Row = Record<string, unknown>;

/** Minimal database interface implemented by both `pg` (production) and PGlite (dev/tests). */
export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements without parameters (used for migrations). */
  exec(sql: string): Promise<void>;
  /** Run `fn` inside a transaction. Throwing rolls back. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}
