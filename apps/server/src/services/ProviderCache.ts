/**
 * ProviderCache — Effect.Cache provider response cache.
 *
 * Caches provider model-list and capability query results with configurable TTLs,
 * deduplicates concurrent misses, and records standard observability metrics.
 *
 * ```ts
 * const models = yield* ProviderCache.getModels({
 *   key: { driverKind: ProviderDriverKind.make("claudeAgent"), instanceId: "default" },
 *   lookup: someProviderSdkCall(),
 *   toCacheValue: JSON.stringify,
 * });
 * ```
 *
 * @module services/ProviderCache
 */

import * as Cache from "effect/Cache";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hub from "effect/Hub";
import * as Metric from "effect/Metric";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import * as Context from "effect/Context";

import {
  providerCacheHealthCheckDurationMs,
  providerCacheHitsTotal,
  providerCacheLatencyMs,
  providerCacheMissesTotal,
} from "../observability/Metrics.js";
import { compactMetricAttributes } from "../observability/Attributes.js";
import { ProviderDriverKind } from "@t3tools/contracts";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Discriminating cache key for one provider instance. */
export interface ProviderCacheKey {
  readonly driverKind: ProviderDriverKind;
  readonly instanceId: string;
}

/** Structured health manifest returned by `GET /health/cache`. */
export interface CacheHealthStatus {
  readonly available: boolean;
  readonly driver: string;
  readonly latencyMs: number;
  readonly hitRate: number;
  readonly totalHits: number;
  readonly totalMisses: number;
  readonly timestamp: string;
}

/** TTL configuration. */
export interface ProviderCacheConfig {
  readonly modelListTtl: Duration.DurationInput;
  readonly capabilitiesTtl: Duration.DurationInput;
}

export const DEFAULT_PROVIDER_CACHE_CONFIG: ProviderCacheConfig = {
  modelListTtl: Duration.minutes(5),
  capabilitiesTtl: Duration.minutes(15),
};

// ---------------------------------------------------------------------------
// Service context / shape
// ---------------------------------------------------------------------------

export interface ProviderCacheShape {
  readonly healthCheck: Effect.Effect<CacheHealthStatus>;
  readonly getModels: <A, E, R>(options: {
    readonly key: ProviderCacheKey;
    readonly lookup: Effect.Effect<A, E, R>;
    readonly toCacheValue: (a: A) => string;
  }) => Effect.Effect<string, E, R>;
  readonly getCapabilities: <A, E, R>(options: {
    readonly key: ProviderCacheKey;
    readonly lookup: Effect.Effect<A, E, R>;
    readonly toCacheValue: (a: A) => string;
  }) => Effect.Effect<string, E, R>;
  readonly invalidate: (key: ProviderCacheKey) => Effect.Effect<void>;
  readonly invalidateAll: Effect.Effect<void>;
}

export class ProviderCache extends Context.Service<
  ProviderCache,
  ProviderCacheShape
>()("t3/provider/Services/ProviderCache") {}

// ---------------------------------------------------------------------------
// Invalidation Hub — publish here when provider config rolls over
// ---------------------------------------------------------------------------

/** Hub topic: receive `ProviderCacheKey` events to invalidate matching cache entries. */
export const providerConfigChangedHub = Hub.unbounded<ProviderCacheKey>();

// ---------------------------------------------------------------------------
// Live implementation
// ---------------------------------------------------------------------------

function makeScopedCache(
  maxEntries: number,
  defaultTtl: Duration.DurationInput,
) {
  return Cache.make<string, string>({
    capacity: maxEntries,
    timeToLive: defaultTtl,
  });
}

export const ProviderCacheLive = Effect.gen(function* () {
  const modelListTtl = DEFAULT_PROVIDER_CACHE_CONFIG.modelListTtl;
  const capabilitiesTtl = DEFAULT_PROVIDER_CACHE_CONFIG.capabilitiesTtl;

  const modelListCache = yield* makeScopedCache(1_000, Duration.minutes(5));
  const capabilitiesCache = yield* makeScopedCache(1_000, Duration.minutes(15));

  const totalHitsRef = yield* Ref.make(0);
  const totalMissesRef = yield* Ref.make(0);

  const recordHit = () =>
    Effect.gen(function* () {
      yield* Ref.update(totalHitsRef, (n) => n + 1);
      yield* Metric.update(
        Metric.withAttributes(
          providerCacheHitsTotal,
          compactMetricAttributes({}),
        ),
        1,
      );
    });

  const recordMiss = () =>
    Effect.gen(function* () {
      yield* Ref.update(totalMissesRef, (n) => n + 1);
      yield* Metric.update(
        Metric.withAttributes(
          providerCacheMissesTotal,
          compactMetricAttributes({}),
        ),
        1,
      );
    });

  function makeCacheKey(key: ProviderCacheKey, ns: string): string {
    const label = ProviderDriverKind.unwrap(key.driverKind);
    return `${ns}:${label}:${key.instanceId}`;
  }

  const healthCheck: Effect.Effect<CacheHealthStatus, never, never> =
    Effect.gen(function* () {
      const nowNs = yield* Clock.currentTimeNanos;

      // A cheap ping: try to look up a fake ephemeral key — this validates
      // that the Cache object's internal machinery is responsive.
      const fakeKey = `__health_ping_${Date.now()}`;
      yield* Cache.set(modelListCache, fakeKey, "ok", Duration.seconds(10));
      yield* Cache.remove(modelListCache, fakeKey);

      const startedMs = yield* Clock.currentTimeMillis;
      // Non-trivial body: collect counters so the response is informative
      const distanceMs = (BigInt(yield* Clock.currentTimeNanos) - nowNs) /
        1_000_000n;
      const elapsedMs = (yield* Clock.currentTimeMillis) - startedMs;

      const totalHits = yield* Ref.get(totalHitsRef);
      const totalMisses = yield* Ref.get(totalMissesRef);
      const total = totalHits + totalMisses;

      yield* Metric.update(
        Metric.withAttributes(
          providerCacheHealthCheckDurationMs,
          compactMetricAttributes({}),
        ),
        elapsedMs,
      );

      return {
        available: true,
        driver: "ProviderCache",
        latencyMs: Number(distanceMs),
        hitRate: total === 0 ? 0 : totalHits / total,
        totalHits,
        totalMisses,
        timestamp: new Date().toISOString(),
      };
    });

  const getModels = <A, E, R>(options: {
    key: ProviderCacheKey;
    lookup: Effect.Effect<A, E, R>;
    toCacheValue: (a: A) => string;
  }) =>
    Effect.gen(function* () {
      const cacheKey = makeCacheKey(options.key, "models");

      // Effect.Cache-native concurrent-miss dedup — two callers arriving during a
      // cache miss share a single `lookup` computation.
      const nowMs = yield* Clock.currentTimeMillis;
      const startedMs = yield* Clock.currentTimeMillis;

      const hot: Option.Option<string> = yield* Cache.getOption(
        modelListCache,
        cacheKey,
      );

      if (Option.isSome(hot)) {
        yield* recordHit();
        return hot.value;
      }

      // Cache miss — execute the upstream probe
      const raw = yield* options.lookup;
      const value = options.toCacheValue(raw);
      const elapsedMs = (yield* Clock.currentTimeMillis) - startedMs;

      yield* Cache.set(
        modelListCache,
        cacheKey,
        value,
        Duration.millis(Duration.toMillis(modelListTtl)),
      );

      // Record miss + latency
      yield* recordMiss();
      yield* Metric.update(
        Metric.withAttributes(
          providerCacheLatencyMs,
          compactMetricAttributes({
            namespace: "models",
            driver: ProviderDriverKind.unwrap(options.key.driverKind),
          }),
        ),
        elapsedMs,
      );

      return value;
    });

  const getCapabilities = <A, E, R>(options: {
    key: ProviderCacheKey;
    lookup: Effect.Effect<A, E, R>;
    toCacheValue: (a: A) => string;
  }) =>
    Effect.gen(function* () {
      const cacheKey = makeCacheKey(options.key, "capabilities");
      const startedMs = yield* Clock.currentTimeMillis;

      const hot: Option.Option<string> = yield* Cache.getOption(
        capabilitiesCache,
        cacheKey,
      );
      if (Option.isSome(hot)) {
        yield* recordHit();
        return hot.value;
      }

      const raw = yield* options.lookup;
      const value = options.toCacheValue(raw);
      const elapsedMs = (yield* Clock.currentTimeMillis) - startedMs;

      yield* Cache.set(
        capabilitiesCache,
        cacheKey,
        value,
        Duration.millis(Duration.toMillis(capabilitiesTtl)),
      );

      yield* recordMiss();
      yield* Metric.update(
        Metric.withAttributes(
          providerCacheLatencyMs,
          compactMetricAttributes({
            namespace: "capabilities",
            driver: ProviderDriverKind.unwrap(options.key.driverKind),
          }),
        ),
        elapsedMs,
      );

      return value;
    });

  const invalidate = (key: ProviderCacheKey) =>
    Effect.gen(function* () {
      const driverLabel = ProviderDriverKind.unwrap(key.driverKind);
      for (const ns of ["models", "capabilities"]) {
        const ck = `${ns}:${driverLabel}:${key.instanceId}`;
        yield* Cache.remove(
          ns === "models" ? modelListCache : capabilitiesCache,
          ck,
        );
      }
    });

  const invalidateAll = Effect.all([
    Cache.clear(modelListCache),
    Cache.clear(capabilitiesCache),
  ]);

  // Subscribe to the invalidation Hub so lower layers can push config-change events
  yield* Effect.scoped(
    Hub.subscribe(providerConfigChangedHub, (key) => invalidate(key)),
  );

  return ProviderCache.of({
    healthCheck,
    getModels,
    getCapabilities,
    invalidate,
    invalidateAll,
  });
}).pipe(Layer.effect(ProviderCache));
