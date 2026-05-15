/**
 * ProviderCache.test — unit tests for the Effect.Cache provider response cache.
 *
 * Verifies: cache hit behaviour, miss + promissary insertion, hit-rate accounting,
 * per-key invalidation, invalidateAll, and the healthCheck manifest.
 *
 * @module services/ProviderCache.test
 */

import * as Metrics from "../observability/Metrics.js";
import * as Clock from "@effect/Clock";
import { assert, it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";

import {
  ProviderCache,
  ProviderCacheShape,
  ProviderCacheKey,
  ProviderDriverKind,
  DEFAULT_PROVIDER_CACHE_CONFIG,
  CacheHealthStatus,
} from "./ProviderCache.js";
import { NodeServices } from "@effect/platform-node/NodeServices";
import * as Layer from "effect/Layer";

// ─── Test fixtures ──────────────────────────────────────────────────────────

const TEST_DRIVER = ProviderDriverKind.make("claudeAgent");
const TEST_INSTANCE_ID = "test-instance-1";

const testCacheKey: ProviderCacheKey = {
  driverKind: TEST_DRIVER,
  instanceId: TEST_INSTANCE_ID,
};

const fakeLookup = Effect.succeed("model-list-result");
const fakeLookupCaps = Effect.succeed(JSON.stringify({ toolUse: true }));

// ─── Tests ──────────────────────────────────────────────────────────────────

it.layer(NodeServices.layer)("ProviderCache", (it) => {
  it.effect(
    "getModels returns cached hit on second call within TTL",
    () =>
      Effect.gen(function* () {
        // Deref via Layer — the Layer provides the service, not the class itself
        const pc: ProviderCacheShape = yield* ProviderCache;
        const ttlMs = Duration.toMillis(
          DEFAULT_PROVIDER_CACHE_CONFIG.modelListTtl,
        );

        const first = yield* pc.getModels({
          key: testCacheKey,
          lookup: fakeLookup,
          toCacheValue: JSON.stringify,
        });
        assert.strictEqual(first, "model-list-result");

        // Wait a fraction of the TTL so there's zero possibility of expiry
        yield* Effect.sleep(
          Duration.millis(Math.max(50, Math.floor(ttlMs / 20))),
        );

        // Second call: must be a cache hit — lookup should NOT be called
        const second = yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.die("should never reach upstream"),
          toCacheValue: JSON.stringify,
        });
        assert.strictEqual(second, "model-list-result");
      }),
  );

  it.effect(
    "getCapabilities returns cached hit on second call within TTL",
    () =>
      Effect.gen(function* () {
        const pc: ProviderCacheShape = yield* ProviderCache;
        const capKey: ProviderCacheKey = {
          driverKind: ProviderDriverKind.make("opencode"),
          instanceId: "opencode-default",
        };

        const first = yield* pc.getCapabilities({
          key: capKey,
          lookup: fakeLookupCaps,
          toCacheValue: JSON.stringify,
        });
        assert.strictEqual(first, '{"toolUse":true}');

        yield* Effect.sleep(Duration.millis(100));
        const second = yield* pc.getCapabilities({
          key: capKey,
          lookup: Effect.die("should never reach upstream"),
          toCacheValue: JSON.stringify,
        });
        assert.strictEqual(second, '{"toolUse":true}');
      }),
  );

  it.effect(
    "getModels evicts entry after TTL expires",
    () =>
      Effect.gen(function* () {
        const pc: ProviderCacheShape = yield* ProviderCache;
        const ttlMs = Duration.toMillis(
          DEFAULT_PROVIDER_CACHE_CONFIG.modelListTtl,
        );

        yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("ttl-test"),
          toCacheValue: (v) => v,
        });

        yield* Effect.sleep(Duration.millis(ttlMs + 200));

        const result = yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("after-ttl"),
          toCacheValue: (v) => v,
        });
        assert.strictEqual(result, "after-ttl");
      }),
  );

  it.effect(
    "invalidate removes a single provider entry",
    () =>
      Effect.gen(function* () {
        const pc: ProviderCacheShape = yield* ProviderCache;

        yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("cached-models"),
          toCacheValue: (v) => v,
        });
        yield* pc.getCapabilities({
          key: testCacheKey,
          lookup: Effect.succeed("cached-caps"),
          toCacheValue: JSON.stringify,
        });

        yield* pc.invalidate(testCacheKey);

        const fresh = yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("fresh-models"),
          toCacheValue: (v) => v,
        });
        assert.strictEqual(fresh, "fresh-models");
      }),
  );

  it.effect(
    "invalidateAll clears every cached entry",
    () =>
      Effect.gen(function* () {
        const pc: ProviderCacheShape = yield* ProviderCache;

        yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("v1"),
          toCacheValue: (v) => v,
        });
        yield* pc.getCapabilities({
          key: testCacheKey,
          lookup: Effect.succeed("v1-caps"),
          toCacheValue: JSON.stringify,
        });

        yield* pc.invalidateAll();

        const freshModels = yield* pc.getModels({
          key: testCacheKey,
          lookup: Effect.succeed("v2"),
          toCacheValue: (v) => v,
        });
        assert.strictEqual(freshModels, "v2");
      }),
  );

  it.effect(
    "healthCheck returns a well-formed CacheHealthStatus",
    () =>
      Effect.gen(function* () {
        const pc: ProviderCacheShape = yield* ProviderCache;
        // Warm cache once so hit count is non-zero
        yield* pc.getModels({
          key: testCacheKey,
          lookup: fakeLookup,
          toCacheValue: JSON.stringify,
        });

        const status: CacheHealthStatus = yield* pc.healthCheck;

        assert.isTrue(status.available);
        assert.strictEqual(status.driver, "ProviderCache");
        assert.isTrue(status.latencyMs >= 0);
        assert.isTrue(status.hitRate >= 0 && status.hitRate <= 1);
        assert.isTrue(status.totalHits >= 1);
        assert.isTrue(
          typeof status.timestamp === "string" && status.timestamp.length > 0,
        );
      }),
  );
});
