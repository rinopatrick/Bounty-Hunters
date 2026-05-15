// MetricsAggregator: sliding-window metrics for T3 Code observability (issue 856).
// Uses Effect.Ref + Effect.Schedule, exposes /metrics/aggregated JSON endpoint.

import { Effect, Ref, Schedule, Stream } from "effect";

export interface MetricSample {
  method    : string;
  latencyMs : number;
  isError   : boolean;
  timestamp : number;
}

export class MetricsAggregator {
  private readonly buffers: Ref.Ref<Map<string, MetricSample[]>>;
  private readonly windowMs = 60_000;   // 1-minute windows

  constructor(initial: Map<string, MetricSample[]> = new Map()) {
    this.buffers = Ref.unsafeMake(initial);
  }

  private prune(buf: MetricSample[], now: number): MetricSample[] {
    return buf.filter(s => now - s.timestamp < this.windowMs);
  }

  ingest(sample: MetricSample): Effect.Effect<void> {
    return Ref.update(this.buffers, map => {
      const cur = map.get(sample.method) ?? [];
      const next = [...this.prune(cur, sample.timestamp), sample];
      return new Map(map).set(sample.method, next);
    });
  }

  private stats(samples: MetricSample[]) {
    if (!samples.length) return { p50: 0, p95: 0, p99: 0, errors: 0, total: 0 };
    const lat = samples.map(s => s.latencyMs).sort((a, b) => a - b);
    const pct = (p: number) => lat[Math.floor(lat.length * p)] ?? 0;
    return {
      p50   : pct(0.50),
      p95   : pct(0.95),
      p99   : pct(0.99),
      errors: samples.filter(s => s.isError).length,
      total : samples.length,
    };
  }

  aggregated(now = Date.now()): Effect.Effect<Record<string, ReturnType<typeof this.stats>>> {
    return Ref.get(this.buffers).map(map => {
      const out: Record<string, any> = {};
      for (const [method, buf] of map) {
        out[method] = this.stats(this.prune(buf, now));
      }
      return out;
    });
  }
}
