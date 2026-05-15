import { Effect } from "effect";
import { SessionCredentialService } from "./SessionCredentialService";

const lastActiveFlush: Record<string, number> = {};

export const SessionCredentialService = Effect.gen(function* () {
  const db = yield* Database; // existing Effect service
  const clock = yield* Clock.Clock;

  const listSessions = (userId: string) =>
    Effect.gen(function* () {
      return yield* db.query(
        `SELECT * FROM sessions WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_active_at DESC`,
        [userId],
      );
    });

  const revokeSession = (sessionId: string) =>
    Effect.gen(function* () {
      yield* db.query(
        `UPDATE sessions SET revoked_at = ? WHERE id = ?`,
        [new Date().toISOString(), sessionId],
      );
    });

  const revokeAllOtherSessions = () =>
    Effect.gen(function* () {
      yield* db.query(
        `UPDATE sessions SET revoked_at = ? WHERE current_session_id != ?`,
        [new Date().toISOString(), /* current session id */ ""],
      );
    });

  const recordActivity = (sessionId: string) =>
    Effect.gen(function* () {
      const now = clock.unsafeCurrentTimeNanos();
      const last = lastActiveFlush[sessionId] || 0;
      if (now - last > 5 * 60 * 1_000_000_000) { // 5 minutes
        yield* db.query(
          `UPDATE sessions SET last_active_at = ? WHERE id = ?`,
          [new Date().toISOString(), sessionId],
        );
        lastActiveFlush[sessionId] = now;
      }
    });

  return { listSessions, revokeSession, revokeAllOtherSessions, recordActivity } as const;
}).pipe(SessionCredentialService.Default);
