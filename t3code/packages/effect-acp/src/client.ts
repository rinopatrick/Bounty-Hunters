import { Effect, Retry, Schedule, Exit, Option } from "effect";
import { ACPClient } from "./Client";
import { TokenStore } from "./TokenStore";

interface RefreshOptions {
  maxRetries: number;
  onSessionExpired: (sessionId: string) => Effect.Effect<void>;
}

export class AutoRefreshConfig extends Effect.Service<AutoRefreshConfig>()("ACP/AutoRefresh", {
  effect: Effect.succeed<RefreshOptions>({
    maxRetries: 1,
    onSessionExpired: (sessionId: string) =>
      Effect.log("Session expired", { sessionId }).pipe(Effect.withSpan("session.expired")),
  }),
  dependencies: [TokenStore.Default],
}) {}

export const withAutoRefresh = <A, E>(self: Effect.Effect<A, E>) =>
  Effect.retry(
    self,
    new Retry.Policy({
      times: 1,
      schedule: Schedule.recurs(1),
      while_: (e: E) =>
        e instanceof Error && /401|auth|unauthoriz/i.test(String(e)),
    }),
  );

export const handleSessionExpired = (client: ACPClient) =>
  Effect.gen(function* () {
    const cfg = yield* AutoRefreshConfig;
    const sessionId = client.sessionId;
    yield* Effect.orDie(cfg.onSessionExpired(sessionId));
    yield* client.refresh();
  });
