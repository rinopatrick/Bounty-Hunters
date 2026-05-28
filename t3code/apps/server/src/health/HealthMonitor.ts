import { Effect, Duration, Schedule } from "effect";
import { Database } from "../schema/Database.js";
import type { HealthReport } from "./HealthReport.js";

export class HealthMonitor extends Effect.Service<HealthMonitor>()("HealthMonitor", {
  effect: Effect.gen(function* () {
    const report = yield* Ref.make<HealthReport>({
      status: "healthy",
      checks: {},
      updatedAt: new Date(),
    });

    const probe = (name: string, check: Effect.Effect<boolean, never>) =>
      Effect.gen(function* () {
        const start = Date.now();
        const ok = yield* Effect.orElse(check, () => Effect.succeed(false));
        return { name, ok, latencyMs: Date.now() - start };
      });

    const runChecks = Effect.all(
      [
        probe("database", Database.health),
        probe("memory",   Effects.memory),
        probe("disk",     Effects.fs),
      ],
      { concurrency: "unbounded" },
    );

    yield* Effect.repeat(
      runChecks.pipe(Effect.flatMap((results) =>
        report.update((prev) => ({
          ...prev,
          status: results.every((r) => r.ok) ? "healthy" : "degraded",
          checks: Object.fromEntries(results.map((r) => [r.name, r])),
          updatedAt: new Date(),
        })),
      )),
      { interval: Duration.ofSeconds(30) },
    );

    return { report };
  }),
}) {}
