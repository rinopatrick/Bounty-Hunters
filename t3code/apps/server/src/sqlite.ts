// SQLite WAL mode + connection pool (issue 858).
import Database from "better-sqlite3"; import { Effect, Pool } from "effect";
export function openDb(path:string){const d=new Database(path);d.pragma("journal_mode=WAL");return d;}
export const dbPool = Pool.make({size:4,acquire:()=>Effect.sync(()=>openDb("app.db")),release:(d)=>Effect.sync(()=>d.close())});