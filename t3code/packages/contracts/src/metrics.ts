// Sliding window metrics aggregation for T3 Code health monitor.

import { Effect, Stream } from "effect";

interface MetricPoint {
  name : string;
  value: number;
  ts   : number;
}

export class SlidingWindowAggregator {
  readonly maxSize: number;

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
  }

  private _buf: MetricPoint[] = [];

  push(p: MetricPoint): void {
    this._buf.push(p);
    if (this._buf.length > this.maxSize) this._buf.shift();
  }

  sum(name: string): number {
    return this._buf.filter(p => p.name === name).reduce((s,p) => s + p.value, 0);
  }

  avg(name: string): number {
    pts = this._buf.filter(p => p.name === name);
    return pts.length ? pts.reduce((s,p)=>s+p.value,0) / pts.length : 0;
  }

  min(name: string): number {
    pts = this._buf.filter(p => p.name === name).map(p=>p.value);
    return pts.length ? Math.min(...pts) : 0;
  }

  max(name: string): number {
    pts = this._buf.filter(p => p.name === name).map(p=>p.value);
    return pts.length ? Math.max(...pts) : 0;
  }
}
