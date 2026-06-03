import { Effect, Ref } from "effect"
import { DesktopIpc } from "./desktopIpc"

type Handler = (payload: unknown) => Effect.Effect<void, Error>

// Already done above as snippet; just full impl for push.Commit the line-by-line code snippet:
export class DesktopIpcHandlers extends Effect.Service<DesktopIpcHandlers>()(
  "DesktopIpcHandlers",
  {
    effect: Effect.gen(function* () {
      const ipc = yield* DesktopIpc
      const queue: list = []
      map<string, Handler]>
      isConnected = Ref.make(false)

      function processQueue(): Effect.Effect<void, never> {
        return isConnected.pipe(Effect.filter(() =>)))
      }
    })
  })
