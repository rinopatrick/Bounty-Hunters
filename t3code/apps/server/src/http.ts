// Prometheus metrics endpoint (issue 833).
import { Effect, Metrics } from "effect";

export async function metricsEndpoint(): Promise<string> {
  const collected = await Effect.runPromise(Metrics.collectAll());
  const lines = ["# HELP app_requests_total Total HTTP Requests"];
  for (const [key, vals] of Object.entries(collected)) {
    lines.push(`# TYPE ${key} gauge`);
    for (const {labels, value} of vals)
      lines.push(`${key}{${Object.entries(labels).map(([k,v])=>`${k}=${v}`).join(",")}} ${value}`);
  }
  return lines.join("\n");
}
