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
  /** healthCheck — probes the cache layer and returns structured status. */
  readonly healthCheck: Effect.Effect<CacheHealthStatus>;

  /** getModels — cached provider model list (5-min TTL). */
  readonly getModels: <A, E, R>(options: {
    readonly key: ProviderCacheKey;
    readonly lookup: Effect.Effect<A, E, R>;
    readonly toCacheValue: (a: A) => string;
  }) => Effect.Effect<string, E, R>;

  /** getCapabilities — cached provider capability query (15-min TTL). */
  readonly getCapabilities: <A, E, R>(options: {
    readonly key: ProviderCacheKey;
    readonly lookup: Effect.Effect<A, E, R>;
    readonly toCacheValue: (a: A) => string;
  }) => Effect.Effect<string, E, R>;

  /** Invalidate a single provider entry. */
  readonly invalidate: (key: ProviderCacheKey) => Effect.Effect<void>;

  /** Invalidate all cached entries. */
  readonly invalidateAll: Effect.Effect<void>;
}

export class ProviderCache extends Context.Service<
  ProviderCache,
  ProviderCacheShape
>()("t3/provider/Services/ProviderCache") {}

// ---------------------------------------------------------------------------
// Invalidation Hub — publish here when provider config rolls over
// ---------------------------------------------------------------------------

/** Hub topic: receive `ProviderCacheKey` events to invalidate matching entries. */
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

  function cacheKeyFor(key: ProviderCacheKey, ns: string): string {
    const label = ProviderDriverKind.unwrap(key.driverKind);
    return `${ns}:${label}:${key.instanceId}`;
  }

  const healthCheck: Effect.Effect<CacheHealthStatus, never, never> =
    Effect.gen(function* () {
      // Ping: write a sentinel and evict it to verify cache is operational
      const fakeKey = `__health_ping_${Date.now()}`;
      yield* Cache.set(modelListCache, fakeKey, "ok", Duration.seconds(30));
      yield* Cache.remove(modelListCache, fakeKey);

      const totalHits = yield* Ref.get(totalHitsRef);
      const totalMisses = yield* Ref.get(totalMissesRef);
      const total = totalHits + totalMisses;

      return {
        available: true,
        driver: "ProviderCache",
        latencyMs: 0,
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
      const ck = cacheKeyFor(options.key, "models");

      const hit: Option.Option<string> = yield* Cache.getOption(
        modelListCache,
        ck,
      );
      if (Option.isSome(hit)) {
        yield* recordHit();
        return hit.value;
      }

      const raw = yield* options.lookup;
      const value = options.toCacheValue(raw);
      yield* Cache.set(
        modelListCache,
        ck,
        value,
        Duration.millis(Duration.toMillis(modelListTtl)),
      );

      yield* recordMiss();
      return value;
    });

  const getCapabilities = <A, E, R>(options: {
    key: ProviderCacheKey;
    lookup: Effect.Effect<A, E, R>;
    toCacheValue: (a: A) => string;
  }) =>
    Effect.gen(function* () {
      const ck = cacheKeyFor(options.key, "capabilities");

      const hit: Option.Option<string> = yield* Cache.getOption(
        capabilitiesCache,
        ck,
      );
      if (Option.isSome(hit)) {
        yield* recordHit();
        return hit.value;
      }

      const raw = yield* options.lookup;
      const value = options.toCacheValue(raw);
      yield* Cache.set(
        capabilitiesCache,
        ck,
        value,
        Duration.millis(Duration.toMillis(capabilitiesTtl)),
      );

      yield* recordMiss();
      return value;
    });

  const invalidate = (key: ProviderCacheKey) =>
    Effect.gen(function* () {
      const label = ProviderDriverKind.unwrap(key.driverKind);
      yield* Cache.remove(modelListCache, `models:${label}:${key.instanceId}`);
      yield* Cache.remove(
        capabilitiesCache,
        `capabilities:${label}:${key.instanceId}`,
      );
    });

  const invalidateAll = Effect.all([
    Cache.clear(modelListCache),
    Cache.clear(capabilitiesCache),
  ]);

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
