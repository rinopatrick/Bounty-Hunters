// Tailscale peer diagnostics widget.

export interface PeerInfo {
  id         : string;
  hostName   : string;
  online     : boolean;
  latencyMs  : number | null;
  lastSeen   : number | null;
}

export interface TailscaleDiagnostics {
  peers      : PeerInfo[];
  updatedAt  : number;
}

export async function fetchTailscaleDiagnostics(
  base = "http://localhost:41184",
): Promise<TailscaleDiagnostics> {
  const r = await fetch(`${base}/tailnet/status`);
  if (!r.ok) throw new Error(`TS status ${r.status}`);
  const data = await r.json();
  return {
    peers     : data.Peers.map((p: any) => ({
      id        : p.NodeID,
      hostName  : p.HostName,
      online    : p.Online,
      latencyMs : p.Online ? p.LatencyMs ?? null : null,
      lastSeen  : p.LastSeen ?? null,
    })),
    updatedAt : Date.now(),
  };
}
