// Tailscale peer diagnostics — diagnosePeer() with latency + relay info (issue 844).

export interface PeerDiagnostics {
  peerId        : string;
  online        : boolean;
  latencyMs     : number | null;
  direct        : boolean | null;
  relayCountry  : string | null;
  lastSeen      : number | null;
  exitNode      : boolean;
}

export async function diagnosePeer(
  peerId: string,
): Promise<PeerDiagnostics> {
  // Use local tailscale CLI.
  const { execSync } = await import("child_process");

  let latencyMs: number | null = null;
  let direct   : boolean | null = null;
  let relayCountry: string | null = null;

  try {
    out = execSync(`tailscale ping ${peerId}`, { encoding: "utf-8", timeout: 5_000 }).trim();
    // "pong from PEER_NAME (IP) in 12.345ms"
    const m = out.match(/in ([\d.]+)ms/i);
    if (m) latencyMs = parseFloat(m[1]);
    direct = !out.toLowerCase().includes("relay");
  } catch { /* peer offline */ }

  try {
    status = execSync("tailscale status", { encoding: "utf-8", timeout: 5_000 });
  } catch {
    status = "";
  }

  // Heuristic: look for relay server country in tailscale status output.
  const relayMatch = status.match(/relay[:\s]+(\S+)/i);
  if (relayMatch) relayCountry = relayMatch[1];

  return {
    peerId,
    online    : latencyMs !== null,
    latencyMs,
    direct,
    relayCountry,
    lastSeen  : latencyMs ? Date.now() : null,
    exitNode  : status.includes("exit node"),
  };
}
