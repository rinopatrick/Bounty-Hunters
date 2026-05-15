import { Effect, Schema } from "effect";

export interface DeviceInfo {
  readonly userAgent: string;
  readonly ipAddress: string;
}

export function detectDevice(ua: string): "desktop" | "mobile" | "tablet" | "unknown" {
  if (/Mobi|Android|iPhone|iPad|iPod/i.test(ua)) {
    return /iPad|Tablet/i.test(ua) ? "tablet" : "mobile";
  }
  return "desktop";
}

export class SessionCredentialService extends Schema.Class<SessionCredentialService>()(
  "SessionCredentialService",
  {
    listSessions:        <E, A>(userId: string) => Effect.Effect<A, E>,
    revokeSession:       <E, A>(sessionId: string) => Effect.Effect<void, E>,
    revokeAllOtherSessions: <E, A>() => Effect.Effect<void, E>,
    recordActivity:      <E, A>(sessionId: string) => Effect.Effect<void, E>,
  },
) {}
